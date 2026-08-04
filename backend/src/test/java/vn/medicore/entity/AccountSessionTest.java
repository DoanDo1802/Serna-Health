package vn.medicore.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AccountSessionTest {

    private static final Instant AUTHENTICATED_AT = Instant.parse("2026-08-04T00:00:00Z");

    @Test
    void expiresAtIdleBoundary() {
        AccountSession session = new AccountSession(
                UUID.randomUUID(), UUID.randomUUID(), AUTHENTICATED_AT, AUTHENTICATED_AT.plus(Duration.ofHours(12)));

        assertThat(session.isUsable(AUTHENTICATED_AT.plus(Duration.ofMinutes(30)), Duration.ofMinutes(30))).isFalse();
        assertThat(session.status()).isEqualTo(AccountSession.Status.EXPIRED);
    }

    @Test
    void revokedSessionCannotBeReused() {
        AccountSession session = new AccountSession(
                UUID.randomUUID(), UUID.randomUUID(), AUTHENTICATED_AT, AUTHENTICATED_AT.plus(Duration.ofHours(12)));

        session.revoke(AUTHENTICATED_AT.plusSeconds(1), "USER_LOGOUT");

        assertThat(session.isUsable(AUTHENTICATED_AT.plusSeconds(2), Duration.ofMinutes(30))).isFalse();
        assertThat(session.status()).isEqualTo(AccountSession.Status.REVOKED);
    }
}
