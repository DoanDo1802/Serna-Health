package vn.medicore.dto;

import java.util.Map;
import java.util.UUID;

public record CatalogAuditContext(
        UUID actorAccountId,
        String sessionId,
        Map<String, Object> permissionSnapshot,
        String requestId,
        String correlationId) {
}
