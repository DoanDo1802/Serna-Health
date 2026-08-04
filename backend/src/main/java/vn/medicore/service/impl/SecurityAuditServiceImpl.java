package vn.medicore.service.impl;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.AuditModels.AuditEventView;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.repository.PlatformAuditRepository;

@Service
@Transactional
public class SecurityAuditServiceImpl implements SecurityAuditRecorder {

    private final PlatformAuditRepository store;
    private final UuidV7Generator ids;
    private final Clock clock;

    public SecurityAuditServiceImpl(PlatformAuditRepository store, UuidV7Generator ids, Clock clock) {
        this.store = store;
        this.ids = ids;
        this.clock = clock;
    }

    @Override
    public void record(
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
            String correlationId) {
        store.insertAudit(new AuditEventView(
                ids.next(),
                actorAccountId == null ? "SYSTEM" : "ACCOUNT",
                actorAccountId,
                roleSnapshot,
                null,
                "system_security_audit",
                "role_based_access_control",
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
}
