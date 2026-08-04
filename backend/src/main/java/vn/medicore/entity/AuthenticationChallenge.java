package vn.medicore.entity;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class AuthenticationChallenge {

    public enum Status {
        PENDING,
        CONSUMED,
        EXPIRED,
        REVOKED,
        LOCKED
    }

    private final UUID id;
    private final String secretHash;
    private final Instant expiresAt;
    private final int maxAttempts;
    private int attemptCount;
    private Status status;
    private Instant consumedAt;

    public AuthenticationChallenge(UUID id, String secretHash, Instant expiresAt, int maxAttempts) {
        this.id = Objects.requireNonNull(id);
        this.secretHash = Objects.requireNonNull(secretHash);
        this.expiresAt = Objects.requireNonNull(expiresAt);
        this.maxAttempts = maxAttempts;
        this.status = Status.PENDING;
    }

    public boolean consume(String candidateHash, Instant now) {
        if (status != Status.PENDING) {
            return false;
        }
        if (!now.isBefore(expiresAt)) {
            status = Status.EXPIRED;
            return false;
        }
        if (!constantTimeEquals(secretHash, candidateHash)) {
            attemptCount++;
            if (attemptCount >= maxAttempts) {
                status = Status.LOCKED;
            }
            return false;
        }
        status = Status.CONSUMED;
        consumedAt = now;
        return true;
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        if (actual == null) {
            return false;
        }
        int difference = expected.length() ^ actual.length();
        int max = Math.max(expected.length(), actual.length());
        for (int index = 0; index < max; index++) {
            char left = index < expected.length() ? expected.charAt(index) : 0;
            char right = index < actual.length() ? actual.charAt(index) : 0;
            difference |= left ^ right;
        }
        return difference == 0;
    }

    public UUID id() {
        return id;
    }

    public int attemptCount() {
        return attemptCount;
    }

    public Status status() {
        return status;
    }

    public Instant consumedAt() {
        return consumedAt;
    }
}
