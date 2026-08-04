package vn.medicore.dto;

import java.util.Map;
import java.util.UUID;

public interface SecurityAuditRecorder {

    void record(
            UUID actorAccountId,
            Map<String, Object> roleSnapshot,
            String action,
            String outcome,
            String reason,
            String resourceType,
            UUID resourceId,
            Long resourceVersion,
            String sessionId,
            String requestId,
            String correlationId);
}
