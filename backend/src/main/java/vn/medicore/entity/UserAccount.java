package vn.medicore.entity;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class UserAccount {

    private final UUID id;
    private final EmailAddress email;
    private AccountStatus status;
    private int failedLoginCount;
    private Instant lockedUntil;
    private Instant emailVerifiedAt;
    private Instant lastAuthenticatedAt;
    private long version;
    private final Instant createdAt;
    private Instant updatedAt;

    public UserAccount(UUID id, EmailAddress email, Instant now) {
        this(id, email, AccountStatus.PENDING_VERIFICATION, 0, null, null, null, 0, now, now);
    }

    public UserAccount(
            UUID id,
            EmailAddress email,
            AccountStatus status,
            int failedLoginCount,
            Instant lockedUntil,
            Instant emailVerifiedAt,
            Instant lastAuthenticatedAt,
            long version,
            Instant createdAt,
            Instant updatedAt) {
        this.id = Objects.requireNonNull(id);
        this.email = Objects.requireNonNull(email);
        this.status = Objects.requireNonNull(status);
        this.failedLoginCount = failedLoginCount;
        this.lockedUntil = lockedUntil;
        this.emailVerifiedAt = emailVerifiedAt;
        this.lastAuthenticatedAt = lastAuthenticatedAt;
        this.version = version;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        validateState();
    }

    public void verifyEmail(Instant now) {
        if (status != AccountStatus.PENDING_VERIFICATION) {
            throw new IllegalStateException("Account cannot be verified from " + status);
        }
        emailVerifiedAt = now;
        status = AccountStatus.ACTIVE;
        touch(now);
    }

    public boolean canAuthenticate(Instant now) {
        unlockIfElapsed(now);
        return status == AccountStatus.ACTIVE;
    }

    public void recordFailedLogin(Instant now, int maxFailures, Duration lockDuration) {
        if (status != AccountStatus.ACTIVE && status != AccountStatus.TEMPORARILY_LOCKED) {
            return;
        }
        unlockIfElapsed(now);
        if (status != AccountStatus.ACTIVE) {
            return;
        }
        failedLoginCount = Math.min(maxFailures, failedLoginCount + 1);
        if (failedLoginCount >= maxFailures) {
            status = AccountStatus.TEMPORARILY_LOCKED;
            lockedUntil = now.plus(lockDuration);
        }
        touch(now);
    }

    public void recordSuccessfulLogin(Instant now) {
        if (!canAuthenticate(now)) {
            throw new IllegalStateException("Account is not active");
        }
        failedLoginCount = 0;
        lockedUntil = null;
        lastAuthenticatedAt = now;
        touch(now);
    }

    public void changeStatus(AccountStatus target, Instant now) {
        if (target == AccountStatus.PENDING_VERIFICATION) {
            throw new IllegalArgumentException("Cannot restore pending verification status");
        }
        status = target;
        lockedUntil = target == AccountStatus.TEMPORARILY_LOCKED ? lockedUntil : null;
        if (target == AccountStatus.TEMPORARILY_LOCKED && lockedUntil == null) {
            throw new IllegalArgumentException("Temporary lock requires an expiry");
        }
        touch(now);
    }

    private void unlockIfElapsed(Instant now) {
        if (status == AccountStatus.TEMPORARILY_LOCKED && !now.isBefore(lockedUntil)) {
            status = AccountStatus.ACTIVE;
            failedLoginCount = 0;
            lockedUntil = null;
            touch(now);
        }
    }

    private void touch(Instant now) {
        updatedAt = now;
    }

    private void validateState() {
        if (failedLoginCount < 0 || failedLoginCount > 5) {
            throw new IllegalArgumentException("Failed login count is invalid");
        }
        if ((status == AccountStatus.TEMPORARILY_LOCKED) != (lockedUntil != null)) {
            throw new IllegalArgumentException("Account lock state is invalid");
        }
    }

    public UUID id() {
        return id;
    }

    public EmailAddress email() {
        return email;
    }

    public AccountStatus status() {
        return status;
    }

    public int failedLoginCount() {
        return failedLoginCount;
    }

    public Instant lockedUntil() {
        return lockedUntil;
    }

    public Instant emailVerifiedAt() {
        return emailVerifiedAt;
    }

    public Instant lastAuthenticatedAt() {
        return lastAuthenticatedAt;
    }

    public long version() {
        return version;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }
}
