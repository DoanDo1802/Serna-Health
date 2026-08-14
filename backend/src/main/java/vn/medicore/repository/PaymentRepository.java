package vn.medicore.repository;

import java.util.Optional;
import java.util.UUID;
import vn.medicore.dto.PaymentModels.OutboxEventRow;
import vn.medicore.dto.PaymentModels.PaymentIntentRow;
import vn.medicore.dto.PaymentModels.PaymentRow;
import vn.medicore.dto.PaymentModels.WebhookInboxRow;

public interface PaymentRepository {

    void insertPaymentIntent(PaymentIntentRow row);

    void updatePaymentIntent(PaymentIntentRow row, long expectedVersion);

    Optional<PaymentIntentRow> paymentIntentById(UUID id);

    Optional<PaymentIntentRow> paymentIntentByIdForUpdate(UUID id);

    Optional<PaymentIntentRow> paymentIntentBySlotHoldId(UUID slotHoldId);

    Optional<PaymentIntentRow> paymentIntentByProviderReferenceForUpdate(String provider, String providerReference);

    boolean insertWebhookInboxAtomic(WebhookInboxRow row);

    void insertWebhookInbox(WebhookInboxRow row);

    void updateWebhookInbox(WebhookInboxRow row, long expectedVersion);

    Optional<WebhookInboxRow> webhookInboxByProviderAndEventId(String provider, String eventId);

    void insertPayment(PaymentRow row);

    Optional<PaymentRow> paymentById(UUID id);

    Optional<PaymentRow> paymentByIntentId(UUID paymentIntentId);

    Optional<PaymentRow> paymentByProviderTransactionId(String provider, String providerTransactionId);

    void insertOutboxEvent(OutboxEventRow row);

    Optional<OutboxEventRow> outboxEventById(UUID id);
}
