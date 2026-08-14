package vn.medicore.service;

import java.time.Instant;
import vn.medicore.dto.PaymentModels.NormalizedWebhookEvent;

public interface PaymentProviderAdapter {

    String providerName();

    String generateProviderReference(String paymentIntentId);

    String sign(byte[] rawPayload, String eventId, String timestampHeader);

    boolean verifySignature(byte[] rawPayload, String eventId, String timestampHeader, String signatureHeader);

    NormalizedWebhookEvent parseAndNormalize(byte[] rawPayload, String headerEventId, String headerTimestamp);
}
