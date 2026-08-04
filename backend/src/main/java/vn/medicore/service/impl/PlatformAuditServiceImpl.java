package vn.medicore.service.impl;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.config.AuthProperties;
import vn.medicore.dto.AuditModels.AuditEventView;
import vn.medicore.dto.AuditModels.BreakGlassView;
import vn.medicore.dto.AuditModels.Page;
import vn.medicore.repository.PlatformAuditRepository;
import vn.medicore.service.PlatformAuditService;

@Service
@Transactional
public class PlatformAuditServiceImpl implements PlatformAuditService {

    private final PlatformAuditRepository store;
    private final AuthProperties properties;
    private final Clock clock;
    private final UuidV7Generator ids;

    public PlatformAuditServiceImpl(
            PlatformAuditRepository store,
            AuthProperties properties,
            Clock clock,
            UuidV7Generator ids) {
        this.store = store;
        this.properties = properties;
        this.clock = clock;
        this.ids = ids;
    }

    @Override
    public BreakGlassView requestBreakGlass(
            UUID patientId,
            UUID requesterAccountId,
            UUID sessionId,
            Map<String, Object> effectiveRoleSnapshot,
            String purpose,
            String reason,
            Duration requestedTtl,
            String alertReference,
            String ticketReference,
            String requestId,
            String correlationId) {
        Instant now = clock.instant();
        Duration ttl = requestedTtl.compareTo(properties.breakGlass().maxTtl()) > 0
                ? properties.breakGlass().maxTtl()
                : requestedTtl;
        BreakGlassView grant = new BreakGlassView(
                ids.next(),
                requesterAccountId,
                null,
                null,
                patientId,
                purpose,
                reason,
                now,
                now,
                now,
                now.plus(ttl),
                now.plus(properties.breakGlass().reviewWindow()),
                null,
                alertReference,
                ticketReference,
                requestId,
                sessionId == null ? null : sessionId.toString(),
                correlationId,
                "ACTIVE",
                null,
                null,
                0);
        store.insertBreakGlass(grant, effectiveRoleSnapshot);
        audit(
                requesterAccountId,
                patientId,
                "break_glass.request",
                "SUCCEEDED",
                reason,
                grant.id(),
                0L,
                sessionId == null ? null : sessionId.toString(),
                requestId,
                correlationId,
                "clinical.break_glass",
                "emergency_access",
                "patient",
                effectiveRoleSnapshot);
        return grant;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BreakGlassView> listBreakGlass(
            UUID actorId,
            boolean auditReader,
            String status,
            UUID patientId,
            UUID requesterAccountId,
            String cursor,
            int limit) {
        UUID effectiveRequester = auditReader ? requesterAccountId : actorId;
        return page(store.listBreakGlass(status, patientId, effectiveRequester, limit + 1, offset(cursor)), limit);
    }

    @Override
    public BreakGlassView revokeBreakGlass(UUID grantId, UUID actorId, String reason, long version) {
        Instant now = clock.instant();
        BreakGlassView grant = store.breakGlassForUpdate(grantId)
                .orElseThrow(ResourceNotFoundException::new);
        store.revokeBreakGlass(grantId, actorId, reason, now, version);
        audit(actorId, grant.patientId(), "break_glass.revoke", "SUCCEEDED", reason, grantId, version, null, null, null,
                "clinical.break_glass", "revoke_access", "patient", Map.of());
        return store.breakGlassForUpdate(grantId).orElseThrow();
    }

    @Override
    public BreakGlassView reviewBreakGlass(UUID grantId, UUID reviewerId, String outcome, String reason, long version) {
        Instant now = clock.instant();
        BreakGlassView grant = store.breakGlassForUpdate(grantId)
                .orElseThrow(ResourceNotFoundException::new);
        store.reviewBreakGlass(grantId, reviewerId, outcome, reason, now, version);
        audit(reviewerId, grant.patientId(), "break_glass.review", "SUCCEEDED", reason, grantId, version, null, null, null,
                "audit.break_glass.review", "audit_review", "patient", Map.of());
        return store.breakGlassForUpdate(grantId).orElseThrow();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditEventView> listAuditEvents(
            Instant occurredFrom,
            Instant occurredTo,
            UUID patientId,
            UUID actorAccountId,
            String action,
            String outcome,
            String correlationId,
            String cursor,
            int limit) {
        return page(store.listAudit(occurredFrom, occurredTo, patientId, actorAccountId, action, outcome,
                correlationId, limit + 1, offset(cursor)), limit);
    }

    @Override
    @Transactional(readOnly = true)
    public AuditEventView getAuditEvent(UUID eventId) {
        return store.auditEvent(eventId).orElseThrow(ResourceNotFoundException::new);
    }

    private void audit(
            UUID actorAccountId,
            UUID patientId,
            String action,
            String outcome,
            String reason,
            UUID resourceId,
            Long resourceVersion,
            String sessionId,
            String requestId,
            String correlationId,
            String authorizationBasis,
            String purpose,
            String resourceType,
            Map<String, Object> roleSnapshot) {
        store.insertAudit(new AuditEventView(
                ids.next(),
                actorAccountId == null ? "SYSTEM" : "USER",
                actorAccountId,
                roleSnapshot,
                patientId,
                purpose,
                authorizationBasis,
                resourceType,
                resourceId,
                resourceVersion,
                null,
                action,
                outcome,
                reason,
                "MEDICORE_BACKEND",
                action,
                sessionId,
                requestId,
                correlationId,
                null,
                null,
                false,
                false,
                null,
                null,
                null,
                null,
                clock.instant()));
    }

    private static int offset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            return Integer.parseInt(new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Cursor is invalid");
        }
    }

    private static <T> Page<T> page(List<T> values, int limit) {
        boolean hasMore = values.size() > limit;
        List<T> items = hasMore ? values.subList(0, limit) : values;
        String next = hasMore ? Base64.getUrlEncoder().withoutPadding().encodeToString(
                Integer.toString(limit).getBytes(StandardCharsets.UTF_8)) : null;
        return new Page<>(List.copyOf(items), next, hasMore);
    }
}
