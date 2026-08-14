package vn.medicore.service;

import java.util.UUID;
import vn.medicore.dto.PaymentModels.PaymentIntentRow;
import vn.medicore.dto.PaymentModels.SimulatePaymentOutcomeRequest;
import vn.medicore.dto.SchedulingAuditContext;

public interface PaymentService {

    PaymentIntentRow createPaymentIntent(UUID slotHoldId, SchedulingAuditContext context);

    PaymentIntentRow getPaymentIntentForAccess(UUID paymentIntentId);

    PaymentIntentRow getPaymentIntent(UUID paymentIntentId, SchedulingAuditContext context);

    void processPaymentWebhook(
            String provider,
            byte[] rawPayload,
            String eventId,
            String timestampHeader,
            String signatureHeader,
            String correlationId);

    void simulateMockPaymentOutcome(
            UUID paymentIntentId,
            SimulatePaymentOutcomeRequest request,
            SchedulingAuditContext context);
}
