package vn.medicore.entity;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class AccountSession {

    public enum Status {
        ACTIVE,
        EXPIRED,
        REVOKED
    }

    private final UUID id;
    private final UUID accountId;
    private final Instant authenticatedAt;
    private final Instant absoluteExpiresAt;
    private Instant lastSeenAt;
    private Status status;
    private Instant revokedAt;
    private String revokeReason;

    public AccountSession(UUID id, UUID accountId, Instant authenticatedAt, Instant absoluteExpiresAt) {
        this.id = Objects.requireNonNull(id);
        this.accountId = Objects.requireNonNull(accountId);
        this.authenticatedAt = Objects.requireNonNull(authenticatedAt);
        this.absoluteExpiresAt = Objects.requireNonNull(absoluteExpiresAt);
        this.lastSeenAt = authenticatedAt;
        this.status = Status.ACTIVE;
        if (!absoluteExpiresAt.isAfter(authenticatedAt)) {
            throw new IllegalArgumentException("Absolute expiry must follow authentication");
        }
    }

    public boolean isUsable(Instant now, Duration idleTimeout) {
        if (status != Status.ACTIVE) {
            return false;
        }
        if (!now.isBefore(absoluteExpiresAt) || !now.isBefore(lastSeenAt.plus(idleTimeout))) {
            status = Status.EXPIRED;
            return false;
        }
        return true;
    }

    public void touch(Instant now, Duration idleTimeout) {
        if (!isUsable(now, idleTimeout)) {
            throw new IllegalStateException("Session is expired");
        }
        lastSeenAt = now;
    }

    public void revoke(Instant now, String reason) {
        if (status != Status.ACTIVE) {
            return;
        }
        status = Status.REVOKED;
        revokedAt = now;
        revokeReason = Objects.requireNonNull(reason);
    }

    public UUID id() {
        return id;
    }

    public UUID accountId() {
        return accountId;
    }

    public Instant authenticatedAt() {
        return authenticatedAt;
    }

    public Instant absoluteExpiresAt() {
        return absoluteExpiresAt;
    }

    public Instant lastSeenAt() {
        return lastSeenAt;
    }

    public Status status() {
        return status;
    }

    public Instant revokedAt() {
        return revokedAt;
    }

    public String revokeReason() {
        return revokeReason;
    }
}
