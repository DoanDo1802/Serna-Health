package vn.medicore.service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import vn.medicore.dto.AuditModels.AuditEventView;
import vn.medicore.dto.AuditModels.BreakGlassView;
import vn.medicore.dto.AuditModels.Page;

public interface PlatformAuditService {

    BreakGlassView requestBreakGlass(
            UUID patientId,
            UUID requesterAccountId,
            UUID sessionId,
            Map<String, Object> effectiveRoleSnapshot,
            String purpose,
            String reason,
            Duration ttl,
            String alertReference,
            String ticketReference,
            String requestId,
            String correlationId);

    Page<BreakGlassView> listBreakGlass(
            UUID actorId,
            boolean auditReader,
            String status,
            UUID patientId,
            UUID requesterAccountId,
            String cursor,
            int limit);

    BreakGlassView revokeBreakGlass(
            UUID grantId,
            UUID actorId,
            String reason,
            long version,
            UUID sessionId,
            Map<String, Object> effectiveRoleSnapshot,
            String requestId,
            String correlationId);

    BreakGlassView reviewBreakGlass(
            UUID grantId,
            UUID reviewerId,
            String outcome,
            String reason,
            long version,
            UUID sessionId,
            Map<String, Object> effectiveRoleSnapshot,
            String requestId,
            String correlationId);

    Page<AuditEventView> listAuditEvents(
            Instant occurredFrom,
            Instant occurredTo,
            UUID patientId,
            UUID actorAccountId,
            String action,
            String outcome,
            String correlationId,
            String cursor,
            int limit);

    AuditEventView getAuditEvent(UUID eventId);
}
