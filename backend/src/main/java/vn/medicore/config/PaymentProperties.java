package vn.medicore.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "medicore.payment")
public record PaymentProperties(
        boolean mockEnabled,
        String allowedProvider,
        String webhookSecret,
        String signatureVersion,
        String signatureAlgorithm,
        long maxClockSkewSeconds
) {
    public PaymentProperties {
        if (allowedProvider == null || allowedProvider.isBlank()) {
            allowedProvider = "MOCK_PAY";
        }
        if (signatureVersion == null || signatureVersion.isBlank()) {
            signatureVersion = "v1";
        }
        if (signatureAlgorithm == null || signatureAlgorithm.isBlank()) {
            signatureAlgorithm = "HmacSHA256";
        }
        if (maxClockSkewSeconds <= 0) {
            maxClockSkewSeconds = 300;
        }
    }
}
