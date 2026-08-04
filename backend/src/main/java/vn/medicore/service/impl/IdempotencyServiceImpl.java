package vn.medicore.service.impl;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.config.AuthProperties;
import vn.medicore.repository.PlatformAuditRepository;
import vn.medicore.repository.PlatformAuditRepository.IdempotencyRow;

@Service
@Transactional
public class IdempotencyServiceImpl {

    private final PlatformAuditRepository store;
    private final AuthProperties properties;
    private final Clock clock;
    private final UuidV7Generator ids;

    public IdempotencyServiceImpl(
            PlatformAuditRepository store,
            AuthProperties properties,
            Clock clock,
            UuidV7Generator ids) {
        this.store = store;
        this.properties = properties;
        this.clock = clock;
        this.ids = ids;
    }

    public Reservation reserve(String principalScope, String operation, String key, byte[] body) {
        String requestHash = hash(body);
        Optional<IdempotencyRow> found = store.idempotencyForUpdate(principalScope, operation, key);
        if (found.isPresent()) {
            IdempotencyRow existing = found.get();
            if (!existing.requestHash().equals(requestHash)) {
                throw new IdempotencyConflictException();
            }
            return new Reservation(existing.id(), true, existing.status(), existing.responseStatus(), existing.responseId());
        }
        UUID id = ids.next();
        store.insertIdempotency(new IdempotencyRow(
                id, principalScope, operation, key, requestHash, "IN_PROGRESS", null, null, clock.instant().plus(properties.idempotency().ttl())));
        return new Reservation(id, false, "IN_PROGRESS", null, null);
    }

    public void complete(UUID id, int status, UUID responseId) {
        store.completeIdempotency(id, status, responseId, clock.instant());
    }

    public void fail(UUID id, int status, String errorCode) {
        store.failIdempotency(id, status, errorCode, clock.instant());
    }

    private static String hash(byte[] input) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    public record Reservation(
            UUID id,
            boolean replay,
            String status,
            Integer responseStatus,
            UUID responseId) {
    }

    public static final class IdempotencyConflictException extends RuntimeException {
    }
}
