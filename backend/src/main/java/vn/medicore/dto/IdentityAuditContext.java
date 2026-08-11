package vn.medicore.dto;

import java.util.Map;
import java.util.UUID;

public record IdentityAuditContext(
        UUID actorAccountId,
        String sessionId,
        Map<String, Object> effectiveRoleSnapshot,
        String requestId,
        String correlationId) {

    public IdentityAuditContext {
        effectiveRoleSnapshot = Map.copyOf(effectiveRoleSnapshot);
    }
}
