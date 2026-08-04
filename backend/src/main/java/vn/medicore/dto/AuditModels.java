package vn.medicore.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class AuditModels {

    private AuditModels() {
    }

    public record AuditEventView(
            UUID id,
            String actorType,
            UUID actorAccountId,
            Map<String, Object> effectiveRoleSnapshot,
            UUID patientId,
            String purpose,
            String authorizationBasis,
            String resourceType,
            UUID resourceId,
            Long resourceVersion,
            String resourceDigest,
            String action,
            String outcome,
            String reason,
            String sourceSystem,
            String sourceEvent,
            String sessionId,
            String requestId,
            String correlationId,
            Map<String, Object> beforeRedacted,
            Map<String, Object> afterRedacted,
            boolean exportEvent,
            boolean downloadEvent,
            UUID recipientAccountId,
            String deliveryChannel,
            UUID reviewerAccountId,
            String approvalReference,
            Instant occurredAt) {
    }

    public record BreakGlassView(
            UUID id,
            UUID requesterAccountId,
            UUID grantorAccountId,
            UUID reviewerAccountId,
            UUID patientId,
            String purpose,
            String reason,
            Instant requestedAt,
            Instant grantedAt,
            Instant effectiveFrom,
            Instant expiresAt,
            Instant reviewDueAt,
            Instant reviewedAt,
            String alertReference,
            String ticketReference,
            String requestId,
            String sessionId,
            String correlationId,
            String status,
            String reviewOutcome,
            String reviewReason,
            long version) {
    }

    public record Page<T>(List<T> items, String nextCursor, boolean hasMore) {
    }
}
