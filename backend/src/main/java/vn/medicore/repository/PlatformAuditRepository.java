package vn.medicore.repository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import vn.medicore.dto.AuditModels.AuditEventView;
import vn.medicore.dto.AuditModels.BreakGlassView;

public interface PlatformAuditRepository {

    void insertBreakGlass(BreakGlassView value, Map<String, Object> effectiveRoleSnapshot);

    Optional<BreakGlassView> breakGlassForUpdate(UUID grantId);

    List<BreakGlassView> listBreakGlass(String status, UUID patientId, UUID requesterId, int limit, int offset);

    void revokeBreakGlass(UUID grantId, UUID actorId, String reason, Instant now, long version);

    void reviewBreakGlass(UUID grantId, UUID reviewerId, String outcome, String reason, Instant now, long version);

    void insertAudit(AuditEventView value);

    Optional<AuditEventView> auditEvent(UUID eventId);

    List<AuditEventView> listAudit(
            Instant occurredFrom,
            Instant occurredTo,
            UUID patientId,
            UUID actorAccountId,
            String action,
            String outcome,
            String correlationId,
            int limit,
            int offset);

    Optional<IdempotencyRow> idempotencyForUpdate(String principalScope, String operation, String key);

    void deleteExpiredIdempotency(String principalScope, String operation, String key, Instant now);

    boolean insertIdempotency(IdempotencyRow row, Instant now);

    void completeIdempotency(
            UUID id,
            int status,
            byte[] responseBody,
            String contentType,
            String etag,
            String location,
            Map<String, List<String>> responseHeaders,
            String errorCode,
            Instant now);

    void failIdempotency(UUID id, int status, String errorCode, Instant now);

    record IdempotencyRow(
            UUID id,
            String principalScope,
            String operation,
            String key,
            String requestHash,
            String status,
            Integer responseStatus,
            byte[] responseBody,
            String responseContentType,
            String responseEtag,
            String responseLocation,
            Map<String, List<String>> responseHeaders,
            String errorCode,
            Instant expiresAt) {
    }
}
