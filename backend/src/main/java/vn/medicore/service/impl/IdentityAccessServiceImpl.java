package vn.medicore.service.impl;

import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vn.medicore.common.exception.InvalidAuthenticationException;
import vn.medicore.common.exception.InvalidCsrfException;
import vn.medicore.common.exception.RateLimitException;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.config.AuthProperties;
import vn.medicore.config.SecretHasher;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.IdentityAuditContext;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.dto.IdentityModels.AccountView;
import vn.medicore.dto.IdentityModels.AssignmentView;
import vn.medicore.dto.IdentityModels.CommandAccepted;
import vn.medicore.dto.IdentityModels.Page;
import vn.medicore.dto.IdentityModels.PermissionView;
import vn.medicore.dto.IdentityModels.RoleView;
import vn.medicore.dto.IdentityModels.SessionIssue;
import vn.medicore.dto.IdentityModels.SessionView;
import vn.medicore.entity.AccountStatus;
import vn.medicore.entity.EmailAddress;
import vn.medicore.repository.IdentityRepository;
import vn.medicore.repository.IdentityRepository.AccountRow;
import vn.medicore.repository.IdentityRepository.ChallengeRow;
import vn.medicore.repository.IdentityRepository.ChallengeStateRow;
import vn.medicore.repository.IdentityRepository.SessionRow;
import vn.medicore.service.AuthenticationDeliveryService;
import vn.medicore.service.IdentityAccessService;

@Service
@Transactional(noRollbackFor = {
        InvalidAuthenticationException.class,
        RateLimitException.class
})
public class IdentityAccessServiceImpl implements IdentityAccessService {

    private static final String GENERIC_AUTHENTICATION_FAILURE = "Authentication failed";
    private static final String DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=16384,t=2,p=1$c2VjdXJlLWR1bW15LXNhbHQ$JdBZXAClzz/57N0ueJYKPcvN6qeePFH5GSRF4S3hr3Y";
    private final IdentityRepository store;
    private final PasswordPolicy passwordPolicy;
    private final PasswordEncoder passwordEncoder;
    private final SecretHasher secretHasher;
    private final AuthenticationDeliveryService delivery;
    private final AuthProperties properties;
    private final Clock clock;
    private final UuidV7Generator ids;
    private final SecurityAuditRecorder securityAudit;

    public IdentityAccessServiceImpl(
            IdentityRepository store,
            PasswordPolicy passwordPolicy,
            PasswordEncoder passwordEncoder,
            SecretHasher secretHasher,
            AuthenticationDeliveryService delivery,
            AuthProperties properties,
            Clock clock,
            UuidV7Generator ids,
            SecurityAuditRecorder securityAudit) {
        this.store = store;
        this.passwordPolicy = passwordPolicy;
        this.passwordEncoder = passwordEncoder;
        this.secretHasher = secretHasher;
        this.delivery = delivery;
        this.properties = properties;
        this.clock = clock;
        this.ids = ids;
        this.securityAudit = securityAudit;
    }

    @Override
    public CommandAccepted register(String emailValue, String password, String requestId, String sourceIp) {
        EmailAddress email = EmailAddress.of(emailValue);
        passwordPolicy.validate(password);
        Instant now = clock.instant();
        store.lockScope("registration:" + email.normalized());
        if (store.findAccountByEmailForUpdate(email.normalized()).isEmpty()) {
            UUID accountId = ids.next();
            store.insertAccount(new AccountRow(accountId, email.normalized(), email.display(), null,
                    AccountStatus.PENDING_VERIFICATION.name(), 0, null, null, 0, now, now));
            store.insertCredential(ids.next(), accountId, passwordEncoder.encode(password), now);
            issueChallenge(email, accountId, "VERIFY_EMAIL", requestId, sourceIp, now);
        } else {
            passwordEncoder.encode(password);
        }
        return new CommandAccepted(true, requestId);
    }

    @Override
    public CommandAccepted requestEmailVerification(String emailValue, String requestId, String sourceIp) {
        EmailAddress email = EmailAddress.of(emailValue);
        Instant now = clock.instant();
        Optional<AccountRow> account = store.findAccountByEmailForUpdate(email.normalized());
        if (account.isPresent() && AccountStatus.PENDING_VERIFICATION.name().equals(account.get().status())) {
            issueChallenge(email, account.get().id(), "VERIFY_EMAIL", requestId, sourceIp, now);
        }
        return new CommandAccepted(true, requestId);
    }

    @Override
    public AccountView verifyEmail(String emailValue, String code, String token, String requestId) {
        Instant now = clock.instant();
        UUID accountId;
        if (token != null) {
            var stored = store.tokenForUpdate(secretHasher.hash("VERIFY_EMAIL", token), "VERIFY_EMAIL")
                    .orElseThrow(() -> new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE));
            if (!now.isBefore(stored.expiresAt())) {
                store.expireToken(stored.id());
                throw new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE);
            }
            store.consumeToken(stored.id(), now);
            accountId = stored.accountId();
        } else {
            EmailAddress email = EmailAddress.of(emailValue);
            ChallengeStateRow challenge = consumeChallenge(email.normalized(), "VERIFY_EMAIL", code, now);
            accountId = challenge.accountId();
        }
        AccountRow account = store.findAccountByIdForUpdate(accountId)
                .orElseThrow(() -> new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE));
        if (!AccountStatus.PENDING_VERIFICATION.name().equals(account.status())) return account.toView();
        AccountRow verified = new AccountRow(account.id(), account.normalizedEmail(), account.displayEmail(), now,
                AccountStatus.ACTIVE.name(), 0, null, account.lastAuthenticatedAt(), account.version() + 1,
                account.createdAt(), now);
        requireUpdated(store.updateAccount(verified, account.version()));
        return verified.toView();
    }

    @Override
    public SessionIssue loginWithPassword(
            String emailValue, String password, String tabContext, String requestId, String sourceIp, String userAgent) {
        EmailAddress email = EmailAddress.of(emailValue);
        Instant now = clock.instant();
        Optional<AccountRow> found = store.findAccountByEmailForUpdate(email.normalized());
        AccountRow account = found.map(value -> unlockIfElapsed(value, now)).orElse(null);
        String encoded = account == null ? DUMMY_PASSWORD_HASH : store.activeCredentialHash(account.id()).orElse(DUMMY_PASSWORD_HASH);
        boolean passwordMatches = passwordEncoder.matches(password, encoded);
        if (account == null || !AccountStatus.ACTIVE.name().equals(account.status()) || !passwordMatches) {
            if (account != null && AccountStatus.ACTIVE.name().equals(account.status())) recordFailure(account, now);
            throw new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE);
        }
        recordSuccess(account, now);
        return issueSession(account, tabContext, sourceIp, userAgent, now);
    }

    @Override
    public CommandAccepted requestLoginOtp(String emailValue, String requestId, String sourceIp) {
        EmailAddress email = EmailAddress.of(emailValue);
        Instant now = clock.instant();
        Optional<AccountRow> account = store.findAccountByEmailForUpdate(email.normalized());
        if (account.isPresent() && AccountStatus.ACTIVE.name().equals(unlockIfElapsed(account.get(), now).status())) {
            issueChallenge(email, account.get().id(), "LOGIN", requestId, sourceIp, now);
        }
        return new CommandAccepted(true, requestId);
    }

    @Override
    public SessionIssue loginWithOtp(
            String emailValue, String code, String tabContext, String requestId, String sourceIp, String userAgent) {
        EmailAddress email = EmailAddress.of(emailValue);
        Instant now = clock.instant();
        ChallengeStateRow challenge = consumeChallenge(email.normalized(), "LOGIN", code, now);
        AccountRow account = store.findAccountByIdForUpdate(challenge.accountId())
                .orElseThrow(() -> new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE));
        if (!AccountStatus.ACTIVE.name().equals(unlockIfElapsed(account, now).status())) {
            throw new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE);
        }
        recordSuccess(account, now);
        return issueSession(account, tabContext, sourceIp, userAgent, now);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SessionView> currentSession(String rawSessionToken, String tabContext) {
        if (rawSessionToken == null || rawSessionToken.isBlank() || tabContext == null || tabContext.isBlank()) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        Optional<SessionRow> stored = store.activeSession(
                secretHasher.hash("SESSION", rawSessionToken), secretHasher.hash("SESSION_CONTEXT", tabContext));
        if (stored.isEmpty()) return Optional.empty();
        SessionRow session = stored.get();
        if (!now.isBefore(session.absoluteExpiresAt()) || !now.isBefore(session.lastSeenAt().plus(properties.session().idleTimeout()))) {
            return Optional.empty();
        }
        AccountRow account = store.findAccountById(session.accountId()).orElse(null);
        if (account == null || !AccountStatus.ACTIVE.name().equals(account.status())) return Optional.empty();
        return Optional.of(session.toView(account.displayEmail(), store.effectiveRoleCodes(session.accountId(), now),
                store.effectivePermissions(session.accountId(), now),
                session.lastSeenAt().plus(properties.session().idleTimeout())));
    }

    @Override
    public Optional<AuthenticatedAccount> authenticateSession(
            String rawSessionToken, String tabContext, String csrfToken, boolean csrfRequired) {
        if (rawSessionToken == null || rawSessionToken.isBlank() || tabContext == null || tabContext.isBlank()) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        Optional<SessionRow> stored = store.activeSession(
                secretHasher.hash("SESSION", rawSessionToken), secretHasher.hash("SESSION_CONTEXT", tabContext));
        if (stored.isEmpty()) return Optional.empty();
        SessionRow session = stored.get();
        if (!now.isBefore(session.absoluteExpiresAt()) || !now.isBefore(session.lastSeenAt().plus(properties.session().idleTimeout()))) {
            store.expireSession(session.id());
            return Optional.empty();
        }
        if (csrfRequired && (csrfToken == null || !constantTimeEquals(session.csrfTokenHash(), secretHasher.hash("CSRF", csrfToken)))) {
            throw new InvalidCsrfException();
        }
        if (!store.touchSession(session.id(), now)) return Optional.empty();
        List<AuthenticatedAccount.EffectiveGrant> grants = store.effectiveGrants(session.accountId(), now).stream()
                .map(grant -> new AuthenticatedAccount.EffectiveGrant(grant.action(), grant.assignmentId(), grant.departmentId(),
                        grant.effectiveFrom(), grant.effectiveTo()))
                .toList();
        return Optional.of(new AuthenticatedAccount(session.id(), session.accountId(),
                store.effectivePermissions(session.accountId(), now), grants));
    }

    @Override
    public void logoutCurrent(
            String rawSessionToken, String tabContext, String reason, String requestId, String correlationId) {
        if (rawSessionToken == null || rawSessionToken.isBlank() || tabContext == null || tabContext.isBlank()) return;
        Instant now = clock.instant();
        String sessionHash = secretHasher.hash("SESSION", rawSessionToken);
        String contextHash = secretHasher.hash("SESSION_CONTEXT", tabContext);
        Optional<SessionRow> session = store.activeSession(sessionHash, contextHash);
        store.revokeSessionByHash(sessionHash, contextHash, now, reason);
        session.ifPresent(value -> securityAudit.record(
                value.accountId(),
                Map.of(),
                "identity.session.logout",
                "SUCCEEDED",
                reason,
                "session",
                value.id(),
                null,
                value.id().toString(),
                requestId,
                correlationId));
    }

    @Override
    public void logoutAll(UUID accountId, String reason, IdentityAuditContext audit) {
        store.revokeAllSessions(accountId, clock.instant(), reason);
        recordAudit(audit, "identity.session.logout_all", reason, "account", accountId, null);
    }

    @Override
    public CommandAccepted requestPasswordRecovery(String emailValue, String requestId, String sourceIp) {
        EmailAddress email = EmailAddress.of(emailValue);
        Instant now = clock.instant();
        Optional<AccountRow> account = store.findAccountByEmailForUpdate(email.normalized());
        if (account.isPresent()) {
            String token = secretHasher.randomToken(32);
            store.revokePendingTokens(account.get().id(), "RESET_PASSWORD", now);
            store.insertToken(ids.next(), account.get().id(), "RESET_PASSWORD",
                    secretHasher.hash("RESET_PASSWORD", token), now, now.plus(properties.token().passwordResetTtl()), requestId);
            afterCommit(() -> delivery.sendPasswordResetToken(account.get().displayEmail(), token));
        }
        return new CommandAccepted(true, requestId);
    }

    @Override
    public AccountView resetPassword(String token, String newPassword, String requestId) {
        passwordPolicy.validate(newPassword);
        Instant now = clock.instant();
        var stored = store.tokenForUpdate(secretHasher.hash("RESET_PASSWORD", token), "RESET_PASSWORD")
                .orElseThrow(() -> new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE));
        if (!now.isBefore(stored.expiresAt())) {
            store.expireToken(stored.id());
            throw new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE);
        }
        AccountRow account = store.findAccountByIdForUpdate(stored.accountId())
                .orElseThrow(() -> new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE));
        store.supersedeCredential(account.id(), now, "PASSWORD_RESET");
        store.insertCredential(ids.next(), account.id(), passwordEncoder.encode(newPassword), now);
        store.consumeToken(stored.id(), now);
        store.revokeAllPendingTokens(account.id(), now);
        store.revokeAllSessions(account.id(), now, "PASSWORD_RESET");
        return account.toView();
    }

    @Override
    public AccountView changePassword(UUID accountId, String currentPassword, String newPassword, long version) {
        passwordPolicy.validate(newPassword);
        Instant now = clock.instant();
        AccountRow account = store.findAccountByIdForUpdate(accountId).orElseThrow(ResourceNotFoundException::new);
        if (account.version() != version) throw new StaleVersionException();
        if (!passwordEncoder.matches(currentPassword, store.activeCredentialHash(accountId).orElse(""))) {
            throw new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE);
        }
        store.supersedeCredential(account.id(), now, "PASSWORD_CHANGE");
        store.insertCredential(ids.next(), account.id(), passwordEncoder.encode(newPassword), now);
        store.revokeAllPendingTokens(account.id(), now);
        store.revokeAllSessions(account.id(), now, "PASSWORD_CHANGE");
        return account.toView();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AccountView> listAccounts(String status, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listAccounts(status, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public AccountView getAccount(UUID accountId) {
        return store.findAccountById(accountId).orElseThrow(ResourceNotFoundException::new).toView();
    }

    @Override
    public AccountView changeAccountStatus(
            UUID accountId,
            String status,
            String reason,
            long version,
            IdentityAuditContext audit) {
        AccountStatus target = AccountStatus.valueOf(status);
        if (target == AccountStatus.PENDING_VERIFICATION || target == AccountStatus.TEMPORARILY_LOCKED) {
            throw new IllegalArgumentException("Unsupported administrative account status");
        }
        Instant now = clock.instant();
        AccountRow account = store.findAccountByIdForUpdate(accountId).orElseThrow(ResourceNotFoundException::new);
        if (AccountStatus.PERMANENTLY_LOCKED.name().equals(account.status())) {
            throw new IllegalStateException("Permanently locked accounts are terminal");
        }
        if (account.version() != version) throw new StaleVersionException();
        AccountRow changed = new AccountRow(account.id(), account.normalizedEmail(), account.displayEmail(),
                account.emailVerifiedAt(), target.name(), account.failedLoginCount(), null, account.lastAuthenticatedAt(),
                account.version() + 1, account.createdAt(), now);
        requireUpdated(store.updateAccount(changed, account.version()));
        if (target != AccountStatus.ACTIVE) {
            store.revokeCredentials(accountId, now, reason);
            store.revokeAllPendingTokens(accountId, now);
            store.revokeAllSessions(accountId, now, reason);
        }
        recordAudit(audit, "identity.account.status.change", reason, "account", changed.id(), changed.version());
        return changed.toView();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<RoleView> listRoles(Boolean active, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listRoles(active, limit + 1, offset), limit, offset);
    }

    @Override
    public RoleView createRole(String code, String name, IdentityAuditContext audit) {
        UUID id = ids.next();
        store.insertRole(id, code, name, clock.instant());
        RoleView role = store.role(id).orElseThrow();
        recordAudit(audit, "identity.role.create", null, "role", role.id(), role.version());
        return role;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PermissionView> listPermissions(Boolean active, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listPermissions(active, limit + 1, offset), limit, offset);
    }

    @Override
    public RoleView replaceRolePermissions(
            UUID roleId,
            Set<UUID> permissionIds,
            long version,
            IdentityAuditContext audit) {
        store.replaceRolePermissions(roleId, permissionIds, audit.actorAccountId(), clock.instant(), version);
        RoleView role = store.role(roleId).orElseThrow(ResourceNotFoundException::new);
        recordAudit(audit, "identity.role.permissions.replace", null, "role", role.id(), role.version());
        return role;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AssignmentView> listAssignments(UUID accountId, String status, Instant effectiveAt, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listAssignments(accountId, status, effectiveAt, limit + 1, offset), limit, offset);
    }

    @Override
    public AssignmentView assignRole(
            UUID accountId,
            UUID roleId,
            UUID departmentId,
            Instant effectiveFrom,
            Instant effectiveTo,
            String reason,
            IdentityAuditContext audit) {
        if (effectiveTo != null && !effectiveTo.isAfter(effectiveFrom)) {
            throw new IllegalArgumentException("Role assignment interval is invalid");
        }
        store.findAccountById(accountId).orElseThrow(ResourceNotFoundException::new);
        store.role(roleId).orElseThrow(ResourceNotFoundException::new);
        AssignmentView assignment = new AssignmentView(ids.next(), accountId, roleId, departmentId,
                effectiveFrom, effectiveTo, "ACTIVE", audit.actorAccountId(), reason, 0);
        store.insertAssignment(assignment);
        recordAudit(audit, "identity.assignment.create", reason, "role_assignment", assignment.id(), assignment.version());
        return assignment;
    }

    @Override
    public AssignmentView revokeAssignment(
            UUID assignmentId,
            String reason,
            long version,
            IdentityAuditContext audit) {
        store.revokeAssignment(assignmentId, reason, audit.actorAccountId(), clock.instant(), version);
        AssignmentView assignment = store.assignment(assignmentId).orElseThrow(ResourceNotFoundException::new);
        recordAudit(audit, "identity.assignment.revoke", reason, "role_assignment", assignment.id(), assignment.version());
        return assignment;
    }

    @Override
    @Transactional(readOnly = true)
    public Set<String> effectivePermissions(UUID accountId, Instant at) {
        return store.effectivePermissions(accountId, at);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UUID> activeRoleIds(UUID accountId, Instant at) {
        return store.activeRoleIds(accountId, at);
    }

    private void issueChallenge(EmailAddress email, UUID accountId, String purpose, String requestId, String sourceIp, Instant now) {
        String sourceIpHash = secretHasher.hash("SOURCE_IP", sourceIp == null ? "unknown" : sourceIp);
        store.lockScope("challenge-ip:" + sourceIpHash);
        store.lockScope("challenge-target:" + email.normalized());
        Optional<Instant> latest = store.latestChallengeIssuedAt(email.normalized(), purpose);
        if (latest.isPresent() && now.isBefore(latest.get().plus(properties.otp().resendCooldown()))) {
            throw new RateLimitException(properties.otp().resendCooldown().toSeconds());
        }
        if (store.challengeIssueCount(email.normalized(), sourceIpHash, now.minusSeconds(3600)) >= properties.otp().maxIssuesPerHour()) {
            throw new RateLimitException(60);
        }
        String code = String.format("%06d", Math.floorMod(secretHasher.randomToken(8).hashCode(), 1_000_000));
        store.revokePendingChallenges(email.normalized(), purpose, now);
        store.insertChallenge(new ChallengeRow(ids.next(), accountId, email.normalized(), purpose,
                secretHasher.hash("OTP_" + purpose, code), now, now.plus(properties.otp().ttl()), sourceIpHash, requestId));
        afterCommit(() -> {
            if ("LOGIN".equals(purpose)) delivery.sendLoginCode(email.display(), code);
            else delivery.sendEmailVerificationCode(email.display(), code);
        });
    }

    private void issueVerificationToken(EmailAddress email, UUID accountId, String requestId, Instant now) {
        String token = secretHasher.randomToken(32);
        store.revokePendingTokens(accountId, "VERIFY_EMAIL", now);
        store.insertToken(ids.next(), accountId, "VERIFY_EMAIL", secretHasher.hash("VERIFY_EMAIL", token), now,
                now.plus(properties.token().verificationTtl()), requestId);
        afterCommit(() -> delivery.sendEmailVerificationToken(email.display(), token));
    }

    private ChallengeStateRow consumeChallenge(String normalizedEmail, String purpose, String code, Instant now) {
        ChallengeStateRow challenge = store.pendingChallengeForUpdate(normalizedEmail, purpose)
                .orElseThrow(() -> new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE));
        if (!now.isBefore(challenge.expiresAt())) {
            store.expireChallenge(challenge.id());
            throw new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE);
        }
        String expected = challenge.secretHash();
        String actual = secretHasher.hash("OTP_" + purpose, code == null ? "" : code);
        if (!constantTimeEquals(expected, actual)) {
            int attempts = challenge.attemptCount() + 1;
            store.failChallenge(challenge.id(), attempts, attempts >= properties.otp().maxAttempts());
            throw new InvalidAuthenticationException(GENERIC_AUTHENTICATION_FAILURE);
        }
        store.consumeChallenge(challenge.id(), now);
        return challenge;
    }

    private SessionIssue issueSession(
            AccountRow account, String tabContext, String sourceIp, String userAgent, Instant now) {
        UUID accountId = account.id();
        UUID patientRoleId = UUID.fromString("01980000-0000-7000-8000-000000000005");
        if (store.activeRoleIds(accountId, now).isEmpty()) {
            store.insertAssignment(new AssignmentView(
                    ids.next(), accountId, patientRoleId, null, now, null, "ACTIVE", accountId, "Default patient role", 0
            ));
        }
        String sessionToken = secretHasher.randomToken(32);
        String csrfToken = secretHasher.randomToken(32);
        SessionRow row = new SessionRow(ids.next(), accountId, secretHasher.hash("SESSION", sessionToken),
                secretHasher.hash("CSRF", csrfToken), secretHasher.hash("SESSION_CONTEXT", tabContext), now, now,
                now.plus(properties.session().absoluteTimeout()),
                secretHasher.hash("SOURCE_IP", sourceIp == null ? "unknown" : sourceIp),
                secretHasher.hash("USER_AGENT", userAgent == null ? "unknown" : userAgent));
        store.insertSession(row);
        return new SessionIssue(row.toView(account.displayEmail(), store.effectiveRoleCodes(accountId, now),
                store.effectivePermissions(accountId, now), now.plus(properties.session().idleTimeout())),
                sessionToken, csrfToken);
    }

    private AccountRow unlockIfElapsed(AccountRow account, Instant now) {
        if (AccountStatus.TEMPORARILY_LOCKED.name().equals(account.status()) && !now.isBefore(account.lockedUntil())) {
            AccountRow active = new AccountRow(account.id(), account.normalizedEmail(), account.displayEmail(),
                    account.emailVerifiedAt(), AccountStatus.ACTIVE.name(), 0, null, account.lastAuthenticatedAt(),
                    account.version() + 1, account.createdAt(), now);
            requireUpdated(store.updateAccount(active, account.version()));
            return active;
        }
        return account;
    }

    private void recordFailure(AccountRow account, Instant now) {
        int failures = Math.min(properties.lockout().maxFailures(), account.failedLoginCount() + 1);
        boolean locked = failures >= properties.lockout().maxFailures();
        AccountRow failed = new AccountRow(account.id(), account.normalizedEmail(), account.displayEmail(),
                account.emailVerifiedAt(), locked ? AccountStatus.TEMPORARILY_LOCKED.name() : account.status(), failures,
                locked ? now.plus(properties.lockout().duration()) : null, account.lastAuthenticatedAt(),
                account.version() + 1, account.createdAt(), now);
        requireUpdated(store.updateAccount(failed, account.version()));
        if (locked) {
            store.revokeAllPendingTokens(account.id(), now);
            store.revokeAllSessions(account.id(), now, "ACCOUNT_LOCKED");
        }
    }

    private void recordSuccess(AccountRow account, Instant now) {
        AccountRow successful = new AccountRow(account.id(), account.normalizedEmail(), account.displayEmail(),
                account.emailVerifiedAt(), AccountStatus.ACTIVE.name(), 0, null, now, account.version() + 1,
                account.createdAt(), now);
        requireUpdated(store.updateAccount(successful, account.version()));
    }

    private void recordAudit(
            IdentityAuditContext audit,
            String action,
            String reason,
            String resourceType,
            UUID resourceId,
            Long resourceVersion) {
        securityAudit.record(
                audit.actorAccountId(),
                audit.effectiveRoleSnapshot(),
                action,
                "SUCCEEDED",
                reason,
                resourceType,
                resourceId,
                resourceVersion,
                audit.sessionId(),
                audit.requestId(),
                audit.correlationId());
    }

    private static void requireUpdated(int updated) {
        if (updated != 1) throw new StaleVersionException();
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        return java.security.MessageDigest.isEqual(expected.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                actual.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private static void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                action.run();
            }
        });
    }

    private static int offset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            return Integer.parseInt(new String(Base64.getUrlDecoder().decode(cursor), java.nio.charset.StandardCharsets.UTF_8));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Cursor is invalid");
        }
    }

    private static <T> Page<T> page(List<T> values, int limit, int offset) {
        boolean hasMore = values.size() > limit;
        List<T> items = hasMore ? values.subList(0, limit) : values;
        String next = hasMore ? Base64.getUrlEncoder().withoutPadding().encodeToString(
                Integer.toString(offset + items.size()).getBytes(java.nio.charset.StandardCharsets.UTF_8)) : null;
        return new Page<>(List.copyOf(items), next, hasMore);
    }
}
