package vn.medicore.repository.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.dto.AuditModels.AuditEventView;
import vn.medicore.dto.AuditModels.BreakGlassView;
import vn.medicore.repository.PlatformAuditRepository;

@Repository
public class PlatformAuditJdbcRepositoryImpl implements PlatformAuditRepository {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() { };
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public PlatformAuditJdbcRepositoryImpl(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @Override
    public void insertBreakGlass(BreakGlassView value, Map<String, Object> roleSnapshot) {
        update("""
                insert into break_glass_grant(id, requester_account_id, grantor_account_id,
                    requester_effective_role_snapshot, patient_id, purpose, reason, requested_at, granted_at,
                    effective_from, expires_at, review_due_at, alert_reference, ticket_reference, request_id,
                    session_id, correlation_id, status, version)
                values (?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, value.id(), value.requesterAccountId(), value.grantorAccountId(), json(roleSnapshot),
                value.patientId(), value.purpose(), value.reason(), value.requestedAt(), value.grantedAt(),
                value.effectiveFrom(), value.expiresAt(), value.reviewDueAt(), value.alertReference(),
                value.ticketReference(), value.requestId(), value.sessionId(), value.correlationId(), value.status(), value.version());
    }

    @Override
    public Optional<BreakGlassView> breakGlassForUpdate(UUID grantId) {
        return queryOne("""
                select * from break_glass_grant where id = ? for update
                """, this::breakGlass, grantId);
    }

    @Override
    public List<BreakGlassView> listBreakGlass(String status, UUID patientId, UUID requesterId, int limit, int offset) {
        return jdbc.query("""
                select * from break_glass_grant
                where (cast(? as varchar) is null or status = ?) and (cast(? as uuid) is null or patient_id = ?)
                  and (cast(? as uuid) is null or requester_account_id = ?)
                order by requested_at desc, id limit ? offset ?
                """, this::breakGlass, status, status, patientId, patientId, requesterId, requesterId, limit, offset);
    }

    @Override
    public void revokeBreakGlass(UUID grantId, UUID actorId, String reason, Instant now, long version) {
        int updated = update("""
                update break_glass_grant set status = 'REVOKED', revoked_at = ?, revoked_by_account_id = ?,
                    revoke_reason = ?, version = version + 1
                where id = ? and version = ? and status in ('REQUESTED', 'ACTIVE')
                """, now, actorId, reason, grantId, version);
        if (updated != 1) throw new StaleVersionException();
    }

    @Override
    public void reviewBreakGlass(UUID grantId, UUID reviewerId, String outcome, String reason, Instant now, long version) {
        int updated = update("""
                update break_glass_grant set status = 'REVIEWED', reviewer_account_id = ?, reviewed_at = ?,
                    review_outcome = ?, review_reason = ?, version = version + 1
                where id = ? and version = ? and status in ('ACTIVE', 'EXPIRED', 'REVOKED')
                """, reviewerId, now, outcome, reason, grantId, version);
        if (updated != 1) throw new StaleVersionException();
    }

    @Override
    public void insertAudit(AuditEventView value) {
        update("""
                insert into audit_event(id, actor_type, actor_account_id, effective_role_snapshot, patient_id,
                    purpose, authorization_basis, resource_type, resource_id, resource_version, resource_digest,
                    action, outcome, reason, source_system, source_event, session_id, request_id, correlation_id,
                    before_redacted, after_redacted, export_event, download_event, recipient_account_id,
                    delivery_channel, reviewer_account_id, approval_reference, occurred_at)
                values (?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb,
                    ?, ?, ?, ?, ?, ?, ?)
                """, value.id(), value.actorType(), value.actorAccountId(), json(value.effectiveRoleSnapshot()),
                value.patientId(), value.purpose(), value.authorizationBasis(), value.resourceType(), value.resourceId(),
                value.resourceVersion(), value.resourceDigest(), value.action(), value.outcome(), value.reason(),
                value.sourceSystem(), value.sourceEvent(), value.sessionId(), value.requestId(), value.correlationId(),
                json(value.beforeRedacted()), json(value.afterRedacted()), value.exportEvent(), value.downloadEvent(),
                value.recipientAccountId(), value.deliveryChannel(), value.reviewerAccountId(), value.approvalReference(),
                value.occurredAt());
    }

    @Override
    public Optional<AuditEventView> auditEvent(UUID eventId) {
        return queryOne("select * from audit_event where id = ?", this::audit, eventId);
    }

    @Override
    public List<AuditEventView> listAudit(Instant from, Instant to, UUID patientId, UUID actorAccountId,
                                          String action, String outcome, String correlationId, int limit, int offset) {
        return jdbc.query("""
                select * from audit_event where (?::timestamptz is null or occurred_at >= ?) and (?::timestamptz is null or occurred_at < ?)
                  and (cast(? as uuid) is null or patient_id = ?) and (cast(? as uuid) is null or actor_account_id = ?)
                  and (cast(? as varchar) is null or action = ?) and (cast(? as varchar) is null or outcome = ?)
                  and (cast(? as varchar) is null or correlation_id = ?)
                order by occurred_at desc, id limit ? offset ?
                """, this::audit, sqlArgs(new Object[]{from, from, to, to, patientId, patientId, actorAccountId, actorAccountId,
                action, action, outcome, outcome, correlationId, correlationId, limit, offset}));
    }

    @Override
    public Optional<IdempotencyRow> idempotencyForUpdate(String principalScope, String operation, String key) {
        return queryOne("""
                select id, principal_scope, operation, idempotency_key, request_hash, status, response_status,
                    response_id, expires_at from idempotency_record
                where principal_scope = ? and operation = ? and idempotency_key = ? for update
                """, this::idempotency, principalScope, operation, key);
    }

    @Override
    public void insertIdempotency(IdempotencyRow row) {
        Instant now = Instant.now();
        update("""
                insert into idempotency_record(id, principal_scope, operation, idempotency_key, request_hash,
                    status, created_at, updated_at, expires_at, version)
                values (?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?, 0)
                """, row.id(), row.principalScope(), row.operation(), row.key(), row.requestHash(), now, now, row.expiresAt());
    }

    @Override
    public void completeIdempotency(UUID id, int status, UUID responseId, Instant now) {
        update("""
                update idempotency_record set status = 'SUCCEEDED', response_type = 'RESOURCE', response_id = ?,
                    response_status = ?, updated_at = ?, version = version + 1 where id = ? and status = 'IN_PROGRESS'
                """, responseId, status, now, id);
    }

    @Override
    public void failIdempotency(UUID id, int status, String errorCode, Instant now) {
        update("""
                update idempotency_record set status = 'FAILED', response_status = ?, error_code = ?,
                    updated_at = ?, version = version + 1 where id = ? and status = 'IN_PROGRESS'
                """, status, errorCode, now, id);
    }

    private BreakGlassView breakGlass(ResultSet rs, int row) throws SQLException {
        return new BreakGlassView(uuid(rs, "id"), uuid(rs, "requester_account_id"), uuidNullable(rs, "grantor_account_id"),
                uuidNullable(rs, "reviewer_account_id"), uuid(rs, "patient_id"), rs.getString("purpose"),
                rs.getString("reason"), instant(rs, "requested_at"), instantNullable(rs, "granted_at"),
                instantNullable(rs, "effective_from"), instantNullable(rs, "expires_at"), instantNullable(rs, "review_due_at"),
                instantNullable(rs, "reviewed_at"), rs.getString("alert_reference"), rs.getString("ticket_reference"),
                rs.getString("request_id"), rs.getString("session_id"), rs.getString("correlation_id"),
                rs.getString("status"), rs.getString("review_outcome"), rs.getString("review_reason"), rs.getLong("version"));
    }

    private AuditEventView audit(ResultSet rs, int row) throws SQLException {
        return new AuditEventView(uuid(rs, "id"), rs.getString("actor_type"), uuidNullable(rs, "actor_account_id"),
                map(rs.getString("effective_role_snapshot")), uuidNullable(rs, "patient_id"), rs.getString("purpose"),
                rs.getString("authorization_basis"), rs.getString("resource_type"), uuidNullable(rs, "resource_id"),
                rs.getObject("resource_version", Long.class), rs.getString("resource_digest"), rs.getString("action"),
                rs.getString("outcome"), rs.getString("reason"), rs.getString("source_system"), rs.getString("source_event"),
                rs.getString("session_id"), rs.getString("request_id"), rs.getString("correlation_id"),
                map(rs.getString("before_redacted")), map(rs.getString("after_redacted")), rs.getBoolean("export_event"),
                rs.getBoolean("download_event"), uuidNullable(rs, "recipient_account_id"), rs.getString("delivery_channel"),
                uuidNullable(rs, "reviewer_account_id"), rs.getString("approval_reference"), instant(rs, "occurred_at"));
    }

    private IdempotencyRow idempotency(ResultSet rs, int row) throws SQLException {
        return new IdempotencyRow(uuid(rs, "id"), rs.getString("principal_scope"), rs.getString("operation"),
                rs.getString("idempotency_key"), rs.getString("request_hash"), rs.getString("status"),
                rs.getObject("response_status", Integer.class), uuidNullable(rs, "response_id"), instant(rs, "expires_at"));
    }

    private String json(Map<String, Object> value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Cannot encode redacted audit metadata", exception);
        }
    }

    private Map<String, Object> map(String value) {
        if (value == null) return null;
        try {
            return objectMapper.readValue(value, MAP_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Cannot decode redacted audit metadata", exception);
        }
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

    private static UUID uuid(ResultSet rs, String column) throws SQLException { return rs.getObject(column, UUID.class); }
    private static UUID uuidNullable(ResultSet rs, String column) throws SQLException { return rs.getObject(column, UUID.class); }
    private static Instant instant(ResultSet rs, String column) throws SQLException { return rs.getTimestamp(column).toInstant(); }
    private static Instant instantNullable(ResultSet rs, String column) throws SQLException { var value = rs.getTimestamp(column); return value == null ? null : value.toInstant(); }
}
