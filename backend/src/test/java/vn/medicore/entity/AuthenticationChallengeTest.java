package vn.medicore.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AuthenticationChallengeTest {

    private static final Instant ISSUED_AT = Instant.parse("2026-08-04T00:00:00Z");

    @Test
    void consumesExactlyOnceBeforeExpiry() {
        AuthenticationChallenge challenge = new AuthenticationChallenge(
                UUID.randomUUID(), "expected", ISSUED_AT.plus(10, ChronoUnit.MINUTES), 5);

        assertThat(challenge.consume("expected", ISSUED_AT.plusSeconds(599))).isTrue();
        assertThat(challenge.consume("expected", ISSUED_AT.plusSeconds(599))).isFalse();
        assertThat(challenge.status()).isEqualTo(AuthenticationChallenge.Status.CONSUMED);
    }

    @Test
    void expiresAtCanonicalBoundary() {
        AuthenticationChallenge challenge = new AuthenticationChallenge(
                UUID.randomUUID(), "expected", ISSUED_AT.plus(10, ChronoUnit.MINUTES), 5);

        assertThat(challenge.consume("expected", ISSUED_AT.plusSeconds(600))).isFalse();
        assertThat(challenge.status()).isEqualTo(AuthenticationChallenge.Status.EXPIRED);
    }

    @Test
    void locksOnFifthFailure() {
        AuthenticationChallenge challenge = new AuthenticationChallenge(
                UUID.randomUUID(), "expected", ISSUED_AT.plus(10, ChronoUnit.MINUTES), 5);

        for (int attempt = 0; attempt < 5; attempt++) {
            assertThat(challenge.consume("wrong", ISSUED_AT.plusSeconds(attempt))).isFalse();
        }
        assertThat(challenge.attemptCount()).isEqualTo(5);
        assertThat(challenge.status()).isEqualTo(AuthenticationChallenge.Status.LOCKED);
    }
}
