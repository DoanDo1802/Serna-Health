package vn.medicore.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import vn.medicore.dto.IdentityModels.AccountView;
import vn.medicore.dto.IdentityModels.AssignmentView;
import vn.medicore.dto.IdentityModels.PermissionView;
import vn.medicore.dto.IdentityModels.RoleView;
import vn.medicore.dto.IdentityModels.SessionView;

public interface IdentityRepository {

    void lockScope(String scope);

    Optional<AccountRow> findAccountByEmailForUpdate(String normalizedEmail);

    Optional<AccountRow> findAccountByIdForUpdate(UUID accountId);

    Optional<AccountRow> findAccountById(UUID accountId);

    void insertAccount(AccountRow account);

    int updateAccount(AccountRow account, long expectedVersion);

    void insertCredential(UUID id, UUID accountId, String encodedHash, Instant now);

    Optional<String> activeCredentialHash(UUID accountId);

    void supersedeCredential(UUID accountId, Instant now, String reason);

    void revokeCredentials(UUID accountId, Instant now, String reason);

    void revokePendingChallenges(String normalizedTarget, String purpose, Instant now);

    long challengeIssueCount(String normalizedTarget, String sourceIpHash, Instant since);

    Optional<Instant> latestChallengeIssuedAt(String normalizedTarget, String purpose);

    void insertChallenge(ChallengeRow challenge);

    Optional<ChallengeStateRow> pendingChallengeForUpdate(String normalizedTarget, String purpose);

    void consumeChallenge(UUID id, Instant now);

    void failChallenge(UUID id, int attemptCount, boolean locked);

    void expireChallenge(UUID id);

    void revokePendingTokens(UUID accountId, String purpose, Instant now);

    void revokeAllPendingTokens(UUID accountId, Instant now);

    void insertToken(UUID id, UUID accountId, String purpose, String hash, Instant issuedAt, Instant expiresAt, String requestId);

    Optional<TokenRow> tokenForUpdate(String tokenHash, String purpose);

    void consumeToken(UUID id, Instant now);

    void expireToken(UUID id);

    void insertSession(SessionRow session);

    Optional<SessionRow> activeSession(String sessionTokenHash);

    boolean touchSession(UUID id, Instant now);

    void expireSession(UUID id);

    void revokeSessionByHash(String sessionTokenHash, Instant now, String reason);

    void revokeAllSessions(UUID accountId, Instant now, String reason);

    List<AccountView> listAccounts(String status, int limit, int offset);

    List<RoleView> listRoles(Boolean active, int limit, int offset);

    List<PermissionView> listPermissions(Boolean active, int limit, int offset);

    void insertRole(UUID id, String code, String name, Instant now);

    Optional<RoleView> role(UUID id);

    void replaceRolePermissions(UUID roleId, Set<UUID> permissionIds, UUID actorId, Instant now, long version);

    List<AssignmentView> listAssignments(UUID accountId, String status, Instant effectiveAt, int limit, int offset);

    void insertAssignment(AssignmentView value);

    Optional<AssignmentView> assignment(UUID id);

    void revokeAssignment(UUID id, String reason, UUID actorId, Instant now, long version);

    Set<String> effectivePermissions(UUID accountId, Instant at);

    List<UUID> activeRoleIds(UUID accountId, Instant at);

    record AccountRow(
            UUID id,
            String normalizedEmail,
            String displayEmail,
            Instant emailVerifiedAt,
            String status,
            int failedLoginCount,
            Instant lockedUntil,
            Instant lastAuthenticatedAt,
            long version,
            Instant createdAt,
            Instant updatedAt) {
        public AccountView toView() {
            return new AccountView(id, version, displayEmail, emailVerifiedAt, status, failedLoginCount,
                    lockedUntil, lastAuthenticatedAt, createdAt, updatedAt);
        }
    }

    record ChallengeRow(
            UUID id,
            UUID accountId,
            String normalizedTarget,
            String purpose,
            String secretHash,
            Instant issuedAt,
            Instant expiresAt,
            String sourceIpHash,
            String requestId) {
    }

    record ChallengeStateRow(UUID id, UUID accountId, String secretHash, int attemptCount, Instant expiresAt) {
    }

    record TokenRow(UUID id, UUID accountId, Instant expiresAt) {
    }

    record SessionRow(
            UUID id,
            UUID accountId,
            String sessionTokenHash,
            String csrfTokenHash,
            Instant authenticatedAt,
            Instant lastSeenAt,
            Instant absoluteExpiresAt,
            String sourceIpHash,
            String userAgentHash) {
        public SessionView toView(Set<String> permissions, Instant idleExpiresAt) {
            return new SessionView(accountId, "ACTIVE", authenticatedAt, lastSeenAt, idleExpiresAt, absoluteExpiresAt, permissions);
        }
    }

}
