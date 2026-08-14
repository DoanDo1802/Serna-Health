package vn.medicore.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import vn.medicore.config.PaymentProperties;
import vn.medicore.dto.PaymentModels.NormalizedWebhookEvent;
import vn.medicore.service.PaymentProviderAdapter;

@Component
public class MockPaymentProviderAdapter implements PaymentProviderAdapter {

    private static final String PROVIDER_NAME = "MOCK_PAY";
    private final PaymentProperties properties;
    private final ObjectMapper objectMapper;

    public MockPaymentProviderAdapter(PaymentProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    public String providerName() {
        return PROVIDER_NAME;
    }

    @Override
    public String generateProviderReference(String paymentIntentId) {
        return "mock_pi_" + paymentIntentId;
    }

    @Override
    public String sign(byte[] rawPayload, String eventId, String timestampHeader) {
        String secret = properties.webhookSecret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("Payment webhook secret is not configured");
        }
        byte[] canonical = canonicalBytes(rawPayload, eventId, timestampHeader);
        byte[] hmac = computeHmac(canonical, secret.getBytes(StandardCharsets.UTF_8));
        return "v1=" + HexFormat.of().formatHex(hmac);
    }

    @Override
    public boolean verifySignature(byte[] rawPayload, String eventId, String timestampHeader, String signatureHeader) {
        String secret = properties.webhookSecret();
        if (secret == null || secret.isBlank() || signatureHeader == null || signatureHeader.isBlank()) {
            return false;
        }
        String actualHex = signatureHeader.trim();
        if (actualHex.startsWith("v1=")) {
            actualHex = actualHex.substring(3);
        }
        byte[] canonical = canonicalBytes(rawPayload, eventId, timestampHeader);
        byte[] expectedHmac = computeHmac(canonical, secret.getBytes(StandardCharsets.UTF_8));
        String expectedHex = HexFormat.of().formatHex(expectedHmac);
        return MessageDigest.isEqual(
                expectedHex.getBytes(StandardCharsets.UTF_8),
                actualHex.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public NormalizedWebhookEvent parseAndNormalize(byte[] rawPayload, String headerEventId, String headerTimestamp) {
        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            if (root == null || !root.isObject()) {
                return new NormalizedWebhookEvent(headerEventId, null, null, null, null, null, null, true);
            }
            String eventId = root.hasNonNull("eventId") ? root.path("eventId").asText() : headerEventId;
            String eventType = root.hasNonNull("eventType") ? root.path("eventType").asText() : null;
            String providerTxId = root.hasNonNull("providerTransactionId") ? root.path("providerTransactionId").asText() : null;
            String providerRef = root.hasNonNull("providerReference") ? root.path("providerReference").asText() : null;

            Instant occurredAt = null;
            if (root.hasNonNull("providerOccurredAt")) {
                occurredAt = parseInstant(root.path("providerOccurredAt").asText());
            } else if (headerTimestamp != null && !headerTimestamp.isBlank()) {
                occurredAt = parseInstant(headerTimestamp);
            }

            BigDecimal amount = null;
            if (root.hasNonNull("amount")) {
                try {
                    amount = new BigDecimal(root.path("amount").asText());
                } catch (NumberFormatException ignored) {}
            }

            String currency = root.hasNonNull("currency") ? root.path("currency").asText() : null;

            return new NormalizedWebhookEvent(eventId, eventType, providerTxId, occurredAt, providerRef, amount, currency, false);
        } catch (Exception exception) {
            return new NormalizedWebhookEvent(headerEventId, null, null, null, null, null, null, true);
        }
    }

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException ex1) {
            try {
                return Instant.parse(value);
            } catch (DateTimeParseException ex2) {
                return null;
            }
        }
    }

    private static byte[] canonicalBytes(byte[] rawPayload, String eventId, String timestampHeader) {
        String prefix = "v1\n" + (eventId != null ? eventId : "") + "\n" + (timestampHeader != null ? timestampHeader : "") + "\n";
        byte[] prefixBytes = prefix.getBytes(StandardCharsets.UTF_8);
        byte[] payload = rawPayload != null ? rawPayload : new byte[0];
        byte[] combined = new byte[prefixBytes.length + payload.length];
        System.arraycopy(prefixBytes, 0, combined, 0, prefixBytes.length);
        System.arraycopy(payload, 0, combined, prefixBytes.length, payload.length);
        return combined;
    }

    private static byte[] computeHmac(byte[] data, byte[] key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (NoSuchAlgorithmException | InvalidKeyException exception) {
            throw new IllegalStateException("HmacSHA256 failed", exception);
        }
    }
}
