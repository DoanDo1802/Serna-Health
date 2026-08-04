package vn.medicore.repository.impl;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.dto.IdentityModels.AccountView;
import vn.medicore.dto.IdentityModels.AssignmentView;
import vn.medicore.dto.IdentityModels.PermissionView;
import vn.medicore.dto.IdentityModels.RoleView;
import vn.medicore.repository.IdentityRepository;

@Repository
public class IdentityJdbcRepositoryImpl implements IdentityRepository {

    private final JdbcTemplate jdbc;

    public IdentityJdbcRepositoryImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void lockScope(String scope) {
        jdbc.queryForObject("select 1 from pg_advisory_xact_lock(hashtextextended(?, 0))", Integer.class, scope);
    }

    @Override
    public Optional<AccountRow> findAccountByEmailForUpdate(String normalizedEmail) {
        return queryOne("""
                select id, normalized_email, display_email, email_verified_at, status,
                       failed_login_count, locked_until, last_authenticated_at, version, created_at, updated_at
                from user_account where normalized_email = ? for update
                """, this::accountRow, normalizedEmail);
    }

    @Override
    public Optional<AccountRow> findAccountByIdForUpdate(UUID accountId) {
        return queryOne("""
                select id, normalized_email, display_email, email_verified_at, status,
                       failed_login_count, locked_until, last_authenticated_at, version, created_at, updated_at
                from user_account where id = ? for update
                """, this::accountRow, accountId);
    }

    @Override
    public Optional<AccountRow> findAccountById(UUID accountId) {
        return queryOne("""
                select id, normalized_email, display_email, email_verified_at, status,
                       failed_login_count, locked_until, last_authenticated_at, version, created_at, updated_at
                from user_account where id = ?
                """, this::accountRow, accountId);
    }

    @Override
    public void insertAccount(AccountRow account) {
        update("""
                insert into user_account(id, normalized_email, display_email, email_verified_at, status,
                    failed_login_count, locked_until, last_authenticated_at, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, account.id(), account.normalizedEmail(), account.displayEmail(), account.emailVerifiedAt(),
                account.status(), account.failedLoginCount(), account.lockedUntil(), account.lastAuthenticatedAt(),
                account.version(), account.createdAt(), account.updatedAt());
    }

    @Override
    public int updateAccount(AccountRow account, long expectedVersion) {
        return update("""
                update user_account
                set email_verified_at = ?, status = ?, failed_login_count = ?, locked_until = ?,
                    last_authenticated_at = ?, version = version + 1, updated_at = ?
                where id = ? and version = ?
                """, account.emailVerifiedAt(), account.status(), account.failedLoginCount(), account.lockedUntil(),
                account.lastAuthenticatedAt(), account.updatedAt(), account.id(), expectedVersion);
    }

    @Override
    public void insertCredential(UUID id, UUID accountId, String encodedHash, Instant now) {
        update("""
                insert into password_credential(id, account_id, encoded_hash, status, created_at)
                values (?, ?, ?, 'ACTIVE', ?)
                """, id, accountId, encodedHash, now);
    }

    @Override
    public Optional<String> activeCredentialHash(UUID accountId) {
        return queryOne("select encoded_hash from password_credential where account_id = ? and status = 'ACTIVE'", (rs, row) -> rs.getString(1), accountId);
    }

    @Override
    public void supersedeCredential(UUID accountId, Instant now, String reason) {
        update("""
                update password_credential set status = 'SUPERSEDED', revoked_at = ?, revoke_reason = ?
                where account_id = ? and status = 'ACTIVE'
                """, now, reason, accountId);
    }

    @Override
    public void revokeCredentials(UUID accountId, Instant now, String reason) {
        update("""
                update password_credential set status = 'REVOKED', revoked_at = ?, revoke_reason = ?
                where account_id = ? and status = 'ACTIVE'
                """, now, reason, accountId);
    }

    @Override
    public void revokePendingChallenges(String normalizedTarget, String purpose, Instant now) {
        update("""
                update authentication_challenge set status = 'REVOKED', revoked_at = ?
                where normalized_target = ? and purpose = ? and status = 'PENDING'
                """, now, normalizedTarget, purpose);
    }

    @Override
    public long challengeIssueCount(String normalizedTarget, String sourceIpHash, Instant since) {
        Long count = jdbc.queryForObject("""
                select count(*) from authentication_challenge
                where issued_at >= ? and (normalized_target = ? or source_ip_hash = ?)
                """, Long.class, sqlArgs(new Object[]{since, normalizedTarget, sourceIpHash}));
        return count == null ? 0 : count;
    }

    @Override
    public Optional<Instant> latestChallengeIssuedAt(String normalizedTarget, String purpose) {
        return queryOne("""
                select issued_at from authentication_challenge
                where normalized_target = ? and purpose = ? order by issued_at desc limit 1
                """, (rs, row) -> instant(rs, "issued_at"), normalizedTarget, purpose);
    }

    @Override
    public void insertChallenge(ChallengeRow challenge) {
        update("""
                insert into authentication_challenge(id, account_id, normalized_target, purpose, secret_hash,
                    status, attempt_count, issued_at, expires_at, source_ip_hash, request_id)
                values (?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?, ?)
                """, challenge.id(), challenge.accountId(), challenge.normalizedTarget(), challenge.purpose(),
                challenge.secretHash(), challenge.issuedAt(), challenge.expiresAt(), challenge.sourceIpHash(), challenge.requestId());
    }

    @Override
    public Optional<ChallengeStateRow> pendingChallengeForUpdate(String normalizedTarget, String purpose) {
        return queryOne("""
                select id, account_id, secret_hash, attempt_count, expires_at
                from authentication_challenge
                where normalized_target = ? and purpose = ? and status = 'PENDING'
                for update
                """, (rs, row) -> new ChallengeStateRow(
                uuid(rs, "id"), uuidNullable(rs, "account_id"), rs.getString("secret_hash"),
                rs.getInt("attempt_count"), instant(rs, "expires_at")), normalizedTarget, purpose);
    }

    @Override
    public void consumeChallenge(UUID id, Instant now) {
        update("update authentication_challenge set status = 'CONSUMED', consumed_at = ? where id = ? and status = 'PENDING'", now, id);
    }

    @Override
    public void failChallenge(UUID id, int attemptCount, boolean locked) {
        update("update authentication_challenge set attempt_count = ?, status = ? where id = ? and status = 'PENDING'",
                attemptCount, locked ? "LOCKED" : "PENDING", id);
    }

    @Override
    public void expireChallenge(UUID id) {
        update("update authentication_challenge set status = 'EXPIRED' where id = ? and status = 'PENDING'", id);
    }

    @Override
    public void revokePendingTokens(UUID accountId, String purpose, Instant now) {
        update("""
                update account_token set status = 'REVOKED', revoked_at = ?
                where account_id = ? and purpose = ? and status = 'PENDING'
                """, now, accountId, purpose);
    }

    @Override
    public void revokeAllPendingTokens(UUID accountId, Instant now) {
        update("""
                update account_token set status = 'REVOKED', revoked_at = ?
                where account_id = ? and status = 'PENDING'
                """, now, accountId);
    }

    @Override
    public void insertToken(UUID id, UUID accountId, String purpose, String hash, Instant issuedAt, Instant expiresAt, String requestId) {
        update("""
                insert into account_token(id, account_id, purpose, token_hash, status, issued_at, expires_at, request_id)
                values (?, ?, ?, ?, 'PENDING', ?, ?, ?)
                """, id, accountId, purpose, hash, issuedAt, expiresAt, requestId);
    }

    @Override
    public Optional<TokenRow> tokenForUpdate(String tokenHash, String purpose) {
        return queryOne("""
                select id, account_id, expires_at from account_token
                where token_hash = ? and purpose = ? and status = 'PENDING' for update
                """, (rs, row) -> new TokenRow(uuid(rs, "id"), uuid(rs, "account_id"), instant(rs, "expires_at")), tokenHash, purpose);
    }

    @Override
    public void consumeToken(UUID id, Instant now) {
        update("update account_token set status = 'CONSUMED', consumed_at = ? where id = ? and status = 'PENDING'", now, id);
    }

    @Override
    public void expireToken(UUID id) {
        update("update account_token set status = 'EXPIRED' where id = ? and status = 'PENDING'", id);
    }

    @Override
    public void insertSession(SessionRow session) {
        update("""
                insert into account_session(id, account_id, session_token_hash, csrf_token_hash, status,
                    authenticated_at, last_seen_at, absolute_expires_at, source_ip_hash, user_agent_hash)
                values (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)
                """, session.id(), session.accountId(), session.sessionTokenHash(), session.csrfTokenHash(),
                session.authenticatedAt(), session.lastSeenAt(), session.absoluteExpiresAt(),
                session.sourceIpHash(), session.userAgentHash());
    }

    @Override
    public Optional<SessionRow> activeSession(String sessionTokenHash) {
        return queryOne("""
                select id, account_id, session_token_hash, csrf_token_hash, authenticated_at, last_seen_at,
                    absolute_expires_at, source_ip_hash, user_agent_hash
                from account_session where session_token_hash = ? and status = 'ACTIVE'
                """, this::sessionRow, sessionTokenHash);
    }

    @Override
    public boolean touchSession(UUID id, Instant now) {
        return update("update account_session set last_seen_at = ?, version = version + 1 where id = ? and status = 'ACTIVE'", now, id) == 1;
    }

    @Override
    public void expireSession(UUID id) {
        update("update account_session set status = 'EXPIRED', version = version + 1 where id = ? and status = 'ACTIVE'", id);
    }

    @Override
    public void revokeSessionByHash(String sessionTokenHash, Instant now, String reason) {
        update("""
                update account_session set status = 'REVOKED', revoked_at = ?, revoke_reason = ?, version = version + 1
                where session_token_hash = ? and status = 'ACTIVE'
                """, now, reason, sessionTokenHash);
    }

    @Override
    public void revokeAllSessions(UUID accountId, Instant now, String reason) {
        update("""
                update account_session set status = 'REVOKED', revoked_at = ?, revoke_reason = ?, version = version + 1
                where account_id = ? and status = 'ACTIVE'
                """, now, reason, accountId);
    }

    @Override
    public List<AccountView> listAccounts(String status, int limit, int offset) {
        String sql = """
                select id, display_email, email_verified_at, status, failed_login_count, locked_until,
                    last_authenticated_at, version, created_at, updated_at from user_account
                where (cast(? as varchar) is null or status = ?) order by created_at, id limit ? offset ?
                """;
        return jdbc.query(sql, this::accountView, sqlArgs(new Object[]{status, status, limit, offset}));
    }

    @Override
    public List<RoleView> listRoles(Boolean active, int limit, int offset) {
        List<RoleView> roles = jdbc.query("""
                select id, code, name, active, version, created_at from role
                where (cast(? as boolean) is null or active = ?) order by code limit ? offset ?
                """, this::roleViewWithoutPermissions, active, active, limit, offset);
        return roles.stream().map(role -> new RoleView(role.id(), role.version(), role.code(), role.name(), role.active(), permissionIds(role.id()), role.createdAt())).toList();
    }

    @Override
    public List<PermissionView> listPermissions(Boolean active, int limit, int offset) {
        return jdbc.query("""
                select id, action, description, active, created_at from permission
                where (cast(? as boolean) is null or active = ?) order by action limit ? offset ?
                """, this::permissionView, active, active, limit, offset);
    }

    @Override
    public void insertRole(UUID id, String code, String name, Instant now) {
        update("insert into role(id, code, name, created_at) values (?, ?, ?, ?)", id, code, name, now);
    }

    @Override
    public Optional<RoleView> role(UUID id) {
        return queryOne("select id, code, name, active, version, created_at from role where id = ?", this::roleViewWithoutPermissions, id)
                .map(role -> new RoleView(role.id(), role.version(), role.code(), role.name(), role.active(), permissionIds(role.id()), role.createdAt()));
    }

    @Override
    public void replaceRolePermissions(UUID roleId, Set<UUID> permissionIds, UUID actorId, Instant now, long version) {
        int updated = update("update role set version = version + 1 where id = ? and version = ?", roleId, version);
        if (updated != 1) throw new StaleVersionException();
        update("delete from role_permission where role_id = ?", roleId);
        for (UUID permissionId : permissionIds) {
            update("insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id) values (?, ?, ?, ?)", roleId, permissionId, now, actorId);
        }
    }

    @Override
    public List<AssignmentView> listAssignments(UUID accountId, String status, Instant effectiveAt, int limit, int offset) {
        return jdbc.query("""
                select id, account_id, role_id, department_id, effective_from, effective_to, status,
                    assigned_by_account_id, reason, version from account_role_assignment
                where account_id = ? and (cast(? as varchar) is null or status = ?)
                  and (?::timestamptz is null or (effective_from <= ? and (effective_to is null or effective_to > ?)))
                order by effective_from, id limit ? offset ?
                """, this::assignmentView, sqlArgs(new Object[]{accountId, status, status, effectiveAt, effectiveAt, effectiveAt, limit, offset}));
    }

    @Override
    public void insertAssignment(AssignmentView value) {
        update("""
                insert into account_role_assignment(id, account_id, role_id, department_id, effective_from,
                    effective_to, status, assigned_by_account_id, reason, version)
                values (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, 0)
                """, value.id(), value.accountId(), value.roleId(), value.departmentId(), value.effectiveFrom(),
                value.effectiveTo(), value.assignedByAccountId(), value.reason());
    }

    @Override
    public Optional<AssignmentView> assignment(UUID id) {
        return queryOne("""
                select id, account_id, role_id, department_id, effective_from, effective_to, status,
                    assigned_by_account_id, reason, version from account_role_assignment where id = ?
                """, this::assignmentView, id);
    }

    @Override
    public void revokeAssignment(UUID id, String reason, UUID actorId, Instant now, long version) {
        int updated = update("""
                update account_role_assignment set status = 'REVOKED', revoked_at = ?, revoked_by_account_id = ?,
                    revoke_reason = ?, version = version + 1 where id = ? and version = ? and status = 'ACTIVE'
                """, now, actorId, reason, id, version);
        if (updated != 1) throw new StaleVersionException();
    }

    @Override
    public Set<String> effectivePermissions(UUID accountId, Instant at) {
        return Set.copyOf(jdbc.queryForList("""
                select distinct p.action from account_role_assignment a
                join role r on r.id = a.role_id and r.active
                join role_permission rp on rp.role_id = r.id
                join permission p on p.id = rp.permission_id and p.active
                where a.account_id = ? and a.status = 'ACTIVE' and a.effective_from <= ?
                  and (a.effective_to is null or a.effective_to > ?)
                """, String.class, sqlArgs(new Object[]{accountId, at, at})));
    }

    @Override
    public List<UUID> activeRoleIds(UUID accountId, Instant at) {
        return jdbc.queryForList("""
                select role_id from account_role_assignment where account_id = ? and status = 'ACTIVE'
                and effective_from <= ? and (effective_to is null or effective_to > ?)
                """, UUID.class, sqlArgs(new Object[]{accountId, at, at}));
    }

    private Set<UUID> permissionIds(UUID roleId) {
        return jdbc.queryForList("select permission_id from role_permission where role_id = ?", UUID.class, roleId)
                .stream().collect(Collectors.toUnmodifiableSet());
    }

    private AccountRow accountRow(ResultSet rs, int row) throws SQLException {
        return new AccountRow(uuid(rs, "id"), rs.getString("normalized_email"), rs.getString("display_email"),
                instantNullable(rs, "email_verified_at"), rs.getString("status"), rs.getInt("failed_login_count"),
                instantNullable(rs, "locked_until"), instantNullable(rs, "last_authenticated_at"), rs.getLong("version"),
                instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private SessionRow sessionRow(ResultSet rs, int row) throws SQLException {
        return new SessionRow(uuid(rs, "id"), uuid(rs, "account_id"), rs.getString("session_token_hash"),
                rs.getString("csrf_token_hash"), instant(rs, "authenticated_at"), instant(rs, "last_seen_at"),
                instant(rs, "absolute_expires_at"), rs.getString("source_ip_hash"), rs.getString("user_agent_hash"));
    }

    private AccountView accountView(ResultSet rs, int row) throws SQLException {
        return new AccountView(uuid(rs, "id"), rs.getLong("version"), rs.getString("display_email"),
                instantNullable(rs, "email_verified_at"), rs.getString("status"), rs.getInt("failed_login_count"),
                instantNullable(rs, "locked_until"), instantNullable(rs, "last_authenticated_at"),
                instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private RoleView roleViewWithoutPermissions(ResultSet rs, int row) throws SQLException {
        return new RoleView(uuid(rs, "id"), rs.getLong("version"), rs.getString("code"), rs.getString("name"),
                rs.getBoolean("active"), Set.of(), instant(rs, "created_at"));
    }

    private PermissionView permissionView(ResultSet rs, int row) throws SQLException {
        return new PermissionView(uuid(rs, "id"), rs.getString("action"), rs.getString("description"),
                rs.getBoolean("active"), instant(rs, "created_at"));
    }

    private AssignmentView assignmentView(ResultSet rs, int row) throws SQLException {
        return new AssignmentView(uuid(rs, "id"), uuid(rs, "account_id"), uuid(rs, "role_id"), uuidNullable(rs, "department_id"),
                instant(rs, "effective_from"), instantNullable(rs, "effective_to"), rs.getString("status"),
                uuid(rs, "assigned_by_account_id"), rs.getString("reason"), rs.getLong("version"));
    }

    private <T> Optional<T> queryOne(String sql, org.springframework.jdbc.core.RowMapper<T> mapper, Object... args) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, mapper, sqlArgs(args)));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private int update(String sql, Object... args) {
        return jdbc.update(sql, sqlArgs(args));
    }

    private static Object[] sqlArgs(Object[] args) {
        Object[] converted = args.clone();
        for (int index = 0; index < converted.length; index++) {
            if (converted[index] instanceof Instant instant) converted[index] = Timestamp.from(instant);
        }
        return converted;
    }

    private static UUID uuid(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, UUID.class);
    }

    private static UUID uuidNullable(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, UUID.class);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        return rs.getTimestamp(column).toInstant();
    }

    private static Instant instantNullable(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
