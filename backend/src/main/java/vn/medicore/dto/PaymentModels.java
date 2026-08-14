package vn.medicore.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public interface PaymentModels {

    // --- Database Rows ---

    record PaymentIntentRow(
            UUID id,
            UUID slotHoldId,
            String provider,
            String providerReference,
            BigDecimal amount,
            String currency,
            String status,
            String reconciliationReason,
            long version,
            Instant createdAt,
            Instant updatedAt
    ) {}

    record WebhookInboxRow(
            UUID id,
            String provider,
            String eventId,
            String eventType,
            String providerTransactionId,
            String signatureStatus,
            String payloadHash,
            byte[] rawPayload,
            String payload,
            Instant providerOccurredAt,
            Instant receivedAt,
            String providerTimeTrust,
            BigDecimal amount,
            String currency,
            String status,
            Instant processedAt,
            String errorCode,
            int attempts,
            Instant nextAttemptAt,
            String correlationId,
            long version
    ) {}

    record PaymentRow(
            UUID id,
            UUID paymentIntentId,
            String provider,
            String providerTransactionId,
            BigDecimal amount,
            String currency,
            String status,
            Instant providerOccurredAt,
            String providerTimeTrust,
            UUID webhookInboxId,
            Instant capturedAt,
            Instant createdAt
    ) {}

    record DepositAllocationRow(
            UUID id,
            UUID paymentId,
            UUID appointmentId,
            BigDecimal amount,
            String currency,
            String allocationType,
            UUID sourceAllocationId,
            String status,
            Instant createdAt,
            String correlationId
    ) {}

    record DepositTransferRow(
            UUID id,
            UUID oldAppointmentId,
            UUID newAppointmentId,
            UUID sourceAllocationId,
            UUID targetAllocationId,
            BigDecimal amount,
            String currency,
            BigDecimal differenceAmount,
            String differenceDisposition,
            UUID actorAccountId,
            String reason,
            String correlationId,
            Instant createdAt
    ) {}

    record OutboxEventRow(
            UUID id,
            String aggregateType,
            UUID aggregateId,
            String eventType,
            String payloadSchemaVersion,
            String payload,
            Instant occurredAt,
            Instant publishedAt,
            int attempts,
            String status,
            Instant nextAttemptAt,
            String errorCode,
            String correlationId,
            long version
    ) {}

    // --- Adapter / Normalization ---

    record NormalizedWebhookEvent(
            String eventId,
            String eventType,
            String providerTransactionId,
            Instant providerOccurredAt,
            String providerReference,
            BigDecimal amount,
            String currency,
            boolean malformed
    ) {}

    // --- API Requests / Responses ---

    record SimulatePaymentOutcomeRequest(
            String outcome,
            String providerTransactionId,
            Instant providerOccurredAt,
            BigDecimal amount,
            String currency,
            Boolean corruptSignature
    ) {}

    record CommandAcceptedResponse(
            String status
    ) {}
}
