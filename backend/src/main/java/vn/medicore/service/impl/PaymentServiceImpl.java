package vn.medicore.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.config.PaymentProperties;
import vn.medicore.dto.AuditModels.AuditEventView;
import vn.medicore.dto.PaymentModels.NormalizedWebhookEvent;
import vn.medicore.dto.PaymentModels.OutboxEventRow;
import vn.medicore.dto.PaymentModels.PaymentIntentRow;
import vn.medicore.dto.PaymentModels.PaymentRow;
import vn.medicore.dto.PaymentModels.SimulatePaymentOutcomeRequest;
import vn.medicore.dto.PaymentModels.WebhookInboxRow;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.AppointmentRow;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.SlotHoldJdbcRow;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.repository.PaymentRepository;
import vn.medicore.repository.PlatformAuditRepository;
import vn.medicore.repository.SchedulingRepository;
import vn.medicore.service.PaymentProviderAdapter;
import vn.medicore.service.PaymentService;

@Service
@Transactional
public class PaymentServiceImpl implements PaymentService {

    private final PaymentRepository paymentRepository;
    private final SchedulingRepository schedulingRepository;
    private final PlatformAuditRepository platformAuditRepository;
    private final PaymentProviderAdapter providerAdapter;
    private final PaymentProperties paymentProperties;
    private final Clock clock;
    private final UuidV7Generator ids;
    private final ObjectMapper objectMapper;

    public PaymentServiceImpl(
            PaymentRepository paymentRepository,
            SchedulingRepository schedulingRepository,
            PlatformAuditRepository platformAuditRepository,
            PaymentProviderAdapter providerAdapter,
            PaymentProperties paymentProperties,
            Clock clock,
            UuidV7Generator ids,
            ObjectMapper objectMapper) {
        this.paymentRepository = paymentRepository;
        this.schedulingRepository = schedulingRepository;
        this.platformAuditRepository = platformAuditRepository;
        this.providerAdapter = providerAdapter;
        this.paymentProperties = paymentProperties;
        this.clock = clock;
        this.ids = ids;
        this.objectMapper = objectMapper;
    }

    @Override
    public PaymentIntentRow createPaymentIntent(UUID slotHoldId, SchedulingAuditContext context) {
        Instant now = clock.instant();
        SlotHoldRow hold = schedulingRepository.slotHoldByIdForUpdate(slotHoldId)
                .orElseThrow(ResourceNotFoundException::new);

        if (!"ACTIVE".equals(hold.status())) {
            throw new IllegalStateException("Slot hold is not active");
        }
        if (!hold.expiresAt().isAfter(now)) {
            SlotHoldJdbcRow expired = new SlotHoldJdbcRow(
                    hold.id(), hold.slotId(), hold.patientId(), hold.expiresAt(), hold.depositAmount(),
                    hold.currency(), null, null, null, "EXPIRED", hold.version() + 1, hold.createdAt(), now);
            schedulingRepository.updateSlotHold(expired, hold.version());
            throw new IllegalStateException("Slot hold is expired");
        }

        Optional<PaymentIntentRow> existing = paymentRepository.paymentIntentBySlotHoldId(slotHoldId);
        if (existing.isPresent()) {
            PaymentIntentRow row = existing.get();
            if ("REQUIRES_PAYMENT_METHOD".equals(row.status()) || "PROCESSING".equals(row.status())) {
                return row;
            }
            throw new IllegalStateException("Payment intent already exists with status: " + row.status());
        }

        UUID intentId = ids.next();
        String providerReference = providerAdapter.generateProviderReference(intentId.toString());
        PaymentIntentRow intentRow = new PaymentIntentRow(
                intentId,
                hold.id(),
                providerAdapter.providerName(),
                providerReference,
                hold.depositAmount(),
                hold.currency(),
                "REQUIRES_PAYMENT_METHOD",
                null,
                0,
                now,
                now);

        paymentRepository.insertPaymentIntent(intentRow);
        recordAudit(context, hold.patientId(), "payment_intent.create", "SUCCEEDED", "PaymentIntent",
                intentRow.id(), intentRow.version(), "created", now);

        return intentRow;
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentIntentRow getPaymentIntentForAccess(UUID paymentIntentId) {
        return paymentRepository.paymentIntentById(paymentIntentId)
                .orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentIntentRow getPaymentIntent(UUID paymentIntentId, SchedulingAuditContext context) {
        return paymentRepository.paymentIntentById(paymentIntentId)
                .orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public void processPaymentWebhook(
            String provider,
            byte[] rawPayload,
            String eventId,
            String timestampHeader,
            String signatureHeader,
            String correlationId) {
        Instant now = clock.instant();
        String payloadHash = computeSha256(rawPayload);

        if (!providerAdapter.providerName().equalsIgnoreCase(provider)) {
            paymentRepository.insertWebhookInbox(new WebhookInboxRow(
                    ids.next(), provider != null ? provider : "UNKNOWN",
                    eventId != null ? eventId : ids.next().toString(),
                    "UNKNOWN", null, "NOT_VERIFIED", payloadHash,
                    new String(rawPayload != null ? rawPayload : new byte[0], StandardCharsets.UTF_8),
                    null, now, "UNTRUSTED", null, null, "FAILED", now,
                    "UNSUPPORTED_PROVIDER", 1, null, correlationId, 0));
            return;
        }

        if (eventId == null || eventId.isBlank()) {
            eventId = ids.next().toString();
        }

        Optional<WebhookInboxRow> existingInbox = paymentRepository.webhookInboxByProviderAndEventId(provider, eventId);
        if (existingInbox.isPresent()) {
            // Webhook idempotency boundary: already received / processed
            return;
        }

        boolean signatureValid = providerAdapter.verifySignature(rawPayload, eventId, timestampHeader, signatureHeader);
        String signatureStatus = signatureValid ? "VALID" : "INVALID";

        NormalizedWebhookEvent event = providerAdapter.parseAndNormalize(rawPayload, eventId, timestampHeader);

        String providerTimeTrust;
        if (event.providerOccurredAt() == null) {
            providerTimeTrust = "MISSING";
        } else if (signatureValid && Math.abs(Duration.between(event.providerOccurredAt(), now).toSeconds()) <= paymentProperties.maxClockSkewSeconds()) {
            providerTimeTrust = "TRUSTED";
        } else {
            providerTimeTrust = "UNTRUSTED";
        }

        UUID inboxId = ids.next();
        WebhookInboxRow inbox = new WebhookInboxRow(
                inboxId,
                provider,
                eventId,
                event.eventType() != null ? event.eventType() : "UNKNOWN",
                event.providerTransactionId(),
                signatureStatus,
                payloadHash,
                new String(rawPayload != null ? rawPayload : new byte[0], StandardCharsets.UTF_8),
                event.providerOccurredAt(),
                now,
                providerTimeTrust,
                event.amount(),
                event.currency(),
                "PROCESSING",
                null,
                null,
                1,
                null,
                correlationId,
                0);
        paymentRepository.insertWebhookInbox(inbox);

        if (event.malformed()) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "MALFORMED_PAYLOAD", now), 0);
            return;
        }

        // Locate PaymentIntent
        Optional<PaymentIntentRow> intentOpt = Optional.empty();
        if (event.providerReference() != null && !event.providerReference().isBlank()) {
            intentOpt = paymentRepository.paymentIntentByProviderReferenceForUpdate(provider, event.providerReference());
        }
        if (intentOpt.isEmpty() && event.providerReference() != null && event.providerReference().startsWith("mock_pi_")) {
            try {
                UUID parsedId = UUID.fromString(event.providerReference().substring(8));
                intentOpt = paymentRepository.paymentIntentByIdForUpdate(parsedId);
            } catch (IllegalArgumentException ignored) {}
        }

        if (intentOpt.isEmpty()) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "PAYMENT_INTENT_NOT_FOUND", now), 0);
            return;
        }

        PaymentIntentRow intent = intentOpt.get();
        SlotHoldRow hold = schedulingRepository.slotHoldByIdForUpdate(intent.slotHoldId()).orElse(null);
        if (hold == null) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "SLOT_HOLD_NOT_FOUND", now), 0);
            return;
        }
        AppointmentSlotRow slot = schedulingRepository.appointmentSlotByIdForUpdate(hold.slotId()).orElse(null);
        if (slot == null) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "SLOT_NOT_FOUND", now), 0);
            return;
        }

        // Branch 1: Invalid Signature
        if (!signatureValid) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "INVALID_SIGNATURE", now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", "INVALID_SIGNATURE",
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", "INVALID_SIGNATURE"), correlationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, "INVALID_SIGNATURE", correlationId, now);
            return;
        }

        // Branch 2: Provider Failure Event
        boolean isSuccess = "payment.succeeded".equalsIgnoreCase(event.eventType())
                || "payment.captured".equalsIgnoreCase(event.eventType())
                || "SUCCEEDED".equalsIgnoreCase(event.eventType());

        if (!isSuccess) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "FAILED", null,
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, "PROVIDER_PAYMENT_FAILED", correlationId, now);
            return;
        }

        // Branch 3: Success Event Validation

        // Check duplicate provider transaction ID
        if (event.providerTransactionId() != null) {
            Optional<PaymentRow> existingPayment = paymentRepository.paymentByProviderTransactionId(provider, event.providerTransactionId());
            if (existingPayment.isPresent()) {
                paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "DUPLICATE_PROVIDER_TRANSACTION", now), 0);
                paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                        intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                        intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", "DUPLICATE_PROVIDER_TRANSACTION",
                        intent.version() + 1, intent.createdAt(), now), intent.version());
                recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                        Map.of("intentId", intent.id().toString(), "reason", "DUPLICATE_PROVIDER_TRANSACTION"), correlationId, now);
                recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                        "PaymentIntent", intent.id(), intent.version() + 1, "DUPLICATE_PROVIDER_TRANSACTION", correlationId, now);
                return;
            }
        }

        // Check amount and currency
        boolean amountMismatch = event.amount() == null || event.amount().compareTo(intent.amount()) != 0;
        boolean currencyMismatch = !"VND".equalsIgnoreCase(event.currency());
        if (amountMismatch || currencyMismatch) {
            String reason = amountMismatch ? "AMOUNT_MISMATCH" : "CURRENCY_MISMATCH";
            if (event.amount() != null && event.amount().compareTo(BigDecimal.ZERO) > 0 && event.providerTransactionId() != null) {
                paymentRepository.insertPayment(new PaymentRow(
                        ids.next(), intent.id(), provider, event.providerTransactionId(),
                        event.amount(), "VND".equalsIgnoreCase(event.currency()) ? "VND" : event.currency(),
                        "CAPTURED", event.providerOccurredAt(), providerTimeTrust, inbox.id(), now, now));
            }
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", reason,
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", reason), correlationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, reason, correlationId, now);
            return;
        }

        // Check provider time trust
        if (!"TRUSTED".equals(providerTimeTrust)) {
            String reason = "MISSING".equals(providerTimeTrust) ? "MISSING_PROVIDER_TIME" : "UNTRUSTED_PROVIDER_TIME";
            if (event.providerTransactionId() != null) {
                paymentRepository.insertPayment(new PaymentRow(
                        ids.next(), intent.id(), provider, event.providerTransactionId(),
                        intent.amount(), "VND", "CAPTURED", event.providerOccurredAt(),
                        providerTimeTrust, inbox.id(), now, now));
            }
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", reason,
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", reason), correlationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, reason, correlationId, now);
            return;
        }

        // Check late payment (occurred after hold expiry)
        if (!event.providerOccurredAt().isBefore(hold.expiresAt())) {
            if (event.providerTransactionId() != null) {
                paymentRepository.insertPayment(new PaymentRow(
                        ids.next(), intent.id(), provider, event.providerTransactionId(),
                        intent.amount(), "VND", "CAPTURED", event.providerOccurredAt(),
                        "TRUSTED", inbox.id(), now, now));
            }
            if ("ACTIVE".equals(hold.status())) {
                schedulingRepository.updateSlotHold(new SlotHoldJdbcRow(
                        hold.id(), hold.slotId(), hold.patientId(), hold.expiresAt(), hold.depositAmount(),
                        hold.currency(), null, null, null, "EXPIRED", hold.version() + 1, hold.createdAt(), now), hold.version());
            }
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", "LATE_PAYMENT_AFTER_HOLD_EXPIRY",
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", "LATE_PAYMENT_AFTER_HOLD_EXPIRY"), correlationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, "LATE_PAYMENT_AFTER_HOLD_EXPIRY", correlationId, now);
            return;
        }

        // Check hold status
        if (!"ACTIVE".equals(hold.status())) {
            if (event.providerTransactionId() != null) {
                paymentRepository.insertPayment(new PaymentRow(
                        ids.next(), intent.id(), provider, event.providerTransactionId(),
                        intent.amount(), "VND", "CAPTURED", event.providerOccurredAt(),
                        "TRUSTED", inbox.id(), now, now));
            }
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", "HOLD_NOT_ACTIVE",
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", "HOLD_NOT_ACTIVE"), correlationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, "HOLD_NOT_ACTIVE", correlationId, now);
            return;
        }

        // Check slot capacity
        schedulingRepository.expireActiveHolds(slot.id(), now);
        int activeCount = schedulingRepository.countActiveHoldsAndAppointments(slot.id(), now);
        if (activeCount > slot.capacity()) {
            if (event.providerTransactionId() != null) {
                paymentRepository.insertPayment(new PaymentRow(
                        ids.next(), intent.id(), provider, event.providerTransactionId(),
                        intent.amount(), "VND", "CAPTURED", event.providerOccurredAt(),
                        "TRUSTED", inbox.id(), now, now));
            }
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", "CAPACITY_EXHAUSTED",
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", "CAPACITY_EXHAUSTED"), correlationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, "CAPACITY_EXHAUSTED", correlationId, now);
            return;
        }

        // --- Happy Path (Atomic: Payment + Intent SUCCEEDED + Hold CONSUMED + Appointment CONFIRMED + Audit + Outbox) ---
        UUID paymentId = ids.next();
        String txId = event.providerTransactionId() != null ? event.providerTransactionId() : "mock_tx_" + ids.next();
        PaymentRow payment = new PaymentRow(
                paymentId,
                intent.id(),
                provider,
                txId,
                intent.amount(),
                "VND",
                "CAPTURED",
                event.providerOccurredAt(),
                "TRUSTED",
                inbox.id(),
                now,
                now);
        paymentRepository.insertPayment(payment);

        PaymentIntentRow updatedIntent = new PaymentIntentRow(
                intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                intent.amount(), intent.currency(), "SUCCEEDED", null,
                intent.version() + 1, intent.createdAt(), now);
        paymentRepository.updatePaymentIntent(updatedIntent, intent.version());

        SlotHoldJdbcRow updatedHold = new SlotHoldJdbcRow(
                hold.id(), hold.slotId(), hold.patientId(), hold.expiresAt(), hold.depositAmount(),
                hold.currency(), null, null, null, "CONSUMED", hold.version() + 1, hold.createdAt(), now);
        schedulingRepository.updateSlotHold(updatedHold, hold.version());

        UUID appointmentId = ids.next();
        AppointmentRow appointment = new AppointmentRow(
                appointmentId, hold.patientId(), hold.id(), hold.slotId(),
                "CONFIRMED", 0, now, now);
        schedulingRepository.insertAppointment(appointment);

        paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);

        Map<String, Object> outboxPayload = new LinkedHashMap<>();
        outboxPayload.put("paymentId", paymentId.toString());
        outboxPayload.put("paymentIntentId", intent.id().toString());
        outboxPayload.put("appointmentId", appointmentId.toString());
        outboxPayload.put("slotHoldId", hold.id().toString());
        outboxPayload.put("patientId", hold.patientId().toString());
        outboxPayload.put("slotId", hold.slotId().toString());
        outboxPayload.put("amount", intent.amount().toPlainString());
        outboxPayload.put("currency", "VND");
        outboxPayload.put("capturedAt", now.toString());

        recordOutbox(paymentId, "PAYMENT", "payment.captured.v1", outboxPayload, correlationId, now);

        recordAuditDirect(null, hold.patientId(), "payment.capture", "SUCCEEDED",
                "Payment", paymentId, 0L, "captured", correlationId, now);
    }

    @Override
    public void simulateMockPaymentOutcome(
            UUID paymentIntentId,
            SimulatePaymentOutcomeRequest request,
            SchedulingAuditContext context) {
        if (!paymentProperties.mockEnabled()) {
            throw new AccessDeniedException("Mock payment simulation is disabled");
        }

        PaymentIntentRow intent = paymentRepository.paymentIntentById(paymentIntentId)
                .orElseThrow(ResourceNotFoundException::new);

        String eventId = "mock_evt_" + ids.next();
        String providerTxId = request.providerTransactionId() != null && !request.providerTransactionId().isBlank()
                ? request.providerTransactionId()
                : "mock_tx_" + ids.next();
        Instant occurredAt = request.providerOccurredAt() != null ? request.providerOccurredAt() : clock.instant();

        String outcome = request.outcome() != null ? request.outcome() : "SUCCEEDED";
        String eventType = "FAILED".equalsIgnoreCase(outcome) ? "payment.failed" : "payment.succeeded";

        BigDecimal amount = request.amount() != null ? request.amount() : intent.amount();
        String currency = request.currency() != null ? request.currency() : intent.currency();

        Map<String, Object> payloadMap = new LinkedHashMap<>();
        payloadMap.put("eventId", eventId);
        payloadMap.put("eventType", eventType);
        payloadMap.put("providerTransactionId", providerTxId);
        if (request.providerOccurredAt() != null || !"MISSING".equalsIgnoreCase(outcome)) {
            payloadMap.put("providerOccurredAt", occurredAt.toString());
        }
        payloadMap.put("providerReference", intent.providerReference());
        payloadMap.put("amount", amount.setScale(2).toPlainString());
        payloadMap.put("currency", currency);

        byte[] payloadBytes;
        try {
            payloadBytes = objectMapper.writeValueAsBytes(payloadMap);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to serialize mock event", exception);
        }

        String signature = providerAdapter.sign(payloadBytes, eventId, occurredAt.toString());
        if (Boolean.TRUE.equals(request.corruptSignature())) {
            signature = "v1=invalid_corrupted_signature_hex_value";
        }

        processPaymentWebhook(
                providerAdapter.providerName(),
                payloadBytes,
                eventId,
                occurredAt.toString(),
                signature,
                context.correlationId());
    }

    private static WebhookInboxRow withInboxTerminal(WebhookInboxRow inbox, String status, String errorCode, Instant now) {
        return new WebhookInboxRow(
                inbox.id(), inbox.provider(), inbox.eventId(), inbox.eventType(),
                inbox.providerTransactionId(), inbox.signatureStatus(), inbox.payloadHash(), inbox.payload(),
                inbox.providerOccurredAt(), inbox.receivedAt(), inbox.providerTimeTrust(), inbox.amount(),
                inbox.currency(), status, now, errorCode, inbox.attempts(), inbox.nextAttemptAt(),
                inbox.correlationId(), inbox.version() + 1);
    }

    private void recordOutbox(UUID aggregateId, String aggregateType, String eventType, Map<String, Object> payload, String correlationId, Instant now) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            paymentRepository.insertOutboxEvent(new OutboxEventRow(
                    ids.next(), aggregateType, aggregateId, eventType, "1.0", json, now, null, 0, "PENDING", null, null, correlationId, 0));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to serialize outbox event", exception);
        }
    }

    private void recordAudit(
            SchedulingAuditContext context,
            UUID patientId,
            String action,
            String outcome,
            String resourceType,
            UUID resourceId,
            long resourceVersion,
            String reason,
            Instant now) {
        platformAuditRepository.insertAudit(new AuditEventView(
                ids.next(),
                context.actorAccountId() == null ? "SYSTEM" : "ACCOUNT",
                context.actorAccountId(),
                context.permissionSnapshot(),
                patientId,
                "system_security_audit",
                "role_based_access_control",
                resourceType,
                resourceId,
                resourceVersion,
                null,
                action,
                outcome,
                reason,
                "MEDICORE_BACKEND",
                action,
                context.sessionId(),
                context.requestId(),
                context.correlationId(),
                null,
                null,
                false,
                false,
                null,
                null,
                null,
                null,
                now));
    }

    private void recordAuditDirect(
            UUID actorAccountId,
            UUID patientId,
            String action,
            String outcome,
            String resourceType,
            UUID resourceId,
            Long resourceVersion,
            String reason,
            String correlationId,
            Instant now) {
        String effectiveCorrelationId = correlationId != null && !correlationId.isBlank() ? correlationId : ids.next().toString();
        platformAuditRepository.insertAudit(new AuditEventView(
                ids.next(),
                actorAccountId == null ? "SYSTEM" : "ACCOUNT",
                actorAccountId,
                Map.of(),
                patientId,
                "system_security_audit",
                "role_based_access_control",
                resourceType,
                resourceId,
                resourceVersion,
                null,
                action,
                outcome,
                reason,
                "MEDICORE_BACKEND",
                action,
                null,
                effectiveCorrelationId,
                effectiveCorrelationId,
                null,
                null,
                false,
                false,
                null,
                null,
                null,
                null,
                now));
    }

    private static String computeSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(data != null ? data : new byte[0]));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 not available", exception);
        }
    }
}
