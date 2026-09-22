package vn.medicore.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.AssertTrue;

@Validated
@ConfigurationProperties("medicore.auth")
public record AuthProperties(
        @NotBlank @Size(min = 32) String secretHashKey,
        @Valid @NotNull Otp otp,
        @Valid @NotNull Lockout lockout,
        @Valid @NotNull Session session,
        @Valid @NotNull Token token,
        @Valid @NotNull Idempotency idempotency,
        @Valid @NotNull BreakGlass breakGlass) {

    public record Otp(
            @NotNull Duration ttl,
            @Min(1) @Max(5) int maxAttempts,
            @NotNull Duration resendCooldown,
            @Min(1) int maxIssuesPerHour) {
    }

    public record Lockout(@Min(1) int maxFailures, @NotNull Duration duration) {
    }

    public record Session(
            @NotNull Duration idleTimeout,
            @NotNull Duration absoluteTimeout,
            @NotBlank String cookieNamePrefix,
            boolean secureCookie,
            @NotBlank String sameSite) {

        @AssertTrue(message = "secure-cookie is required for __Host- cookie-name-prefix")
        public boolean isSecurePrefixValid() {
            return !cookieNamePrefix.startsWith("__Host-") || secureCookie;
        }
    }

    public record Token(@NotNull Duration verificationTtl, @NotNull Duration passwordResetTtl) {
    }

    public record Idempotency(@NotNull Duration ttl) {
    }

    public record BreakGlass(@NotNull Duration maxTtl, @NotNull Duration reviewWindow) {
    }
}
