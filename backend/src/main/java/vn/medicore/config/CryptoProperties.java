package vn.medicore.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("medicore.crypto")
public record CryptoProperties(
        @NotBlank @Pattern(regexp = "^[0-9a-fA-F]{64}$") String encryptionKey,
        @NotBlank @Pattern(regexp = "^[0-9a-fA-F]{64}$") String comparisonKey) {
}
