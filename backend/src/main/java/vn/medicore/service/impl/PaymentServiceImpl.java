package vn.medicore.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
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

        // 1. Initial hold lookup
        SlotHoldRow initialHold = schedulingRepository.slotHoldById(slotHoldId)
                .orElseThrow(ResourceNotFoundException::new);

        // 2. Strict lock order: AppointmentSlot -> SlotHold
        schedulingRepository.appointmentSlotByIdForUpdate(initialHold.slotId())
                .orElseThrow(ResourceNotFoundException::new);
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
            if ("REQUIRES_PAYMENT_METHOD".equals(row.status()) || "PROCESSING".equals(row.status()) || "SUCCEEDED".equals(row.status())) {
                return row;
            }
            throw new IllegalStateException("Payment intent already exists with status: " + row.status());
        }

        // 3. Zero-price / Zero-deposit direct-confirmation flow
        if (hold.depositAmount().compareTo(BigDecimal.ZERO) == 0) {
            UUID intentId = ids.next();
            PaymentIntentRow intentRow = new PaymentIntentRow(
                    intentId,
                    hold.id(),
                    "ZERO_PRICE",
                    "zero_" + intentId,
                    BigDecimal.ZERO.setScale(2),
                    hold.currency(),
                    "SUCCEEDED",
                    null,
                    0,
                    now,
                    now);
            paymentRepository.insertPaymentIntent(intentRow);

            SlotHoldJdbcRow consumedHold = new SlotHoldJdbcRow(
                    hold.id(), hold.slotId(), hold.patientId(), hold.expiresAt(), hold.depositAmount(),
                    hold.currency(), null, null, null, "CONSUMED", hold.version() + 1, hold.createdAt(), now);
            schedulingRepository.updateSlotHold(consumedHold, hold.version());

            UUID appointmentId = ids.next();
            AppointmentRow appointment = new AppointmentRow(
                    appointmentId, hold.patientId(), hold.id(), hold.slotId(),
                    "CONFIRMED", 0, now, now);
            schedulingRepository.insertAppointment(appointment);

            Map<String, Object> outboxPayload = new LinkedHashMap<>();
            outboxPayload.put("appointmentId", appointmentId.toString());
            outboxPayload.put("slotHoldId", hold.id().toString());
            outboxPayload.put("patientId", hold.patientId().toString());
            outboxPayload.put("slotId", hold.slotId().toString());
            outboxPayload.put("confirmedAt", now.toString());
            recordOutbox(appointmentId, "APPOINTMENT", "appointment.confirmed.v1", outboxPayload, context.correlationId(), now);

            recordAudit(context, hold.patientId(), "appointment.confirm", "SUCCEEDED", "Appointment",
                    appointmentId, 0L, "zero_price_direct_confirm", now);
            recordAudit(context, hold.patientId(), "payment_intent.create", "SUCCEEDED", "PaymentIntent",
                    intentRow.id(), intentRow.version(), "zero_price_auto_succeeded", now);

            return intentRow;
        }

        // 4. Standard PaymentIntent creation
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
        byte[] payloadBytes = rawPayload != null ? rawPayload : new byte[0];
        String payloadHash = computeSha256(payloadBytes);
        String effectiveEventId = eventId != null && !eventId.isBlank() ? eventId : ids.next().toString();
        String effectiveCorrelationId = correlationId != null && !correlationId.isBlank() ? correlationId : ids.next().toString();

        // Safe JSON parsing for payload
        String payloadJson = null;
        boolean malformedJson = false;
        try {
            JsonNode parsed = objectMapper.readTree(payloadBytes);
            if (parsed != null && parsed.isObject()) {
                payloadJson = objectMapper.writeValueAsString(parsed);
            } else {
                malformedJson = true;
            }
        } catch (Exception ex) {
            malformedJson = true;
        }

        // Mock profile gate
        if ("MOCK_PAY".equalsIgnoreCase(provider) && !paymentProperties.mockEnabled()) {
            WebhookInboxRow gateInbox = new WebhookInboxRow(
                    ids.next(), provider != null ? provider : "UNKNOWN",
                    effectiveEventId, "UNKNOWN", null, "NOT_VERIFIED", payloadHash,
                    payloadBytes, payloadJson, null, now, "UNTRUSTED", null, null, "FAILED", now,
                    "MOCK_PAYMENT_DISABLED", 1, null, effectiveCorrelationId, 0);
            paymentRepository.insertWebhookInboxAtomic(gateInbox);
            recordAuditDirect(null, null, "payment.webhook.receive", "DENIED",
                    "WebhookInbox", gateInbox.id(), 0L, "mock_payment_disabled", effectiveCorrelationId, now);
            return;
        }

        // Provider validation
        if (!providerAdapter.providerName().equalsIgnoreCase(provider)) {
            WebhookInboxRow unsupportedInbox = new WebhookInboxRow(
                    ids.next(), provider != null ? provider : "UNKNOWN",
                    effectiveEventId, "UNKNOWN", null, "NOT_VERIFIED", payloadHash,
                    payloadBytes, payloadJson, null, now, "UNTRUSTED", null, null, "FAILED", now,
                    "UNSUPPORTED_PROVIDER", 1, null, effectiveCorrelationId, 0);
            paymentRepository.insertWebhookInboxAtomic(unsupportedInbox);
            recordAuditDirect(null, null, "payment.webhook.receive", "FAILED",
                    "WebhookInbox", unsupportedInbox.id(), 0L, "unsupported_provider", effectiveCorrelationId, now);
            return;
        }

        boolean signatureValid = providerAdapter.verifySignature(payloadBytes, effectiveEventId, timestampHeader, signatureHeader);
        String signatureStatus = signatureValid ? "VALID" : "INVALID";

        NormalizedWebhookEvent event = providerAdapter.parseAndNormalize(payloadBytes, effectiveEventId, timestampHeader);

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
                effectiveEventId,
                event.eventType() != null ? event.eventType() : "UNKNOWN",
                event.providerTransactionId(),
                signatureStatus,
                payloadHash,
                payloadBytes,
                payloadJson,
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
                effectiveCorrelationId,
                0);

        // Atomic inbox insert: deduplicates concurrent deliveries
        boolean inserted = paymentRepository.insertWebhookInboxAtomic(inbox);
        if (!inserted) {
            // Webhook duplicate race: already received / recorded at inbox boundary
            return;
        }

        // Branch 1: Invalid Signature Quarantined (DO NOT touch PaymentIntent or Appointment)
        if (!signatureValid) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "INVALID_SIGNATURE", now), 0);
            recordAuditDirect(null, null, "payment.webhook.receive", "DENIED",
                    "WebhookInbox", inbox.id(), 0L, "invalid_webhook_signature", effectiveCorrelationId, now);
            return;
        }

        // Branch 2: Malformed payload
        if (event.malformed() || malformedJson) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "MALFORMED_PAYLOAD", now), 0);
            recordAuditDirect(null, null, "payment.webhook.receive", "FAILED",
                    "WebhookInbox", inbox.id(), 0L, "malformed_webhook_payload", effectiveCorrelationId, now);
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
            recordAuditDirect(null, null, "payment.webhook.receive", "FAILED",
                    "WebhookInbox", inbox.id(), 0L, "payment_intent_not_found", effectiveCorrelationId, now);
            return;
        }

        PaymentIntentRow initialIntent = intentOpt.get();

        // Strict unified lock order: AppointmentSlot -> SlotHold -> PaymentIntent -> WebhookInbox -> Payment
        SlotHoldRow initialHold = schedulingRepository.slotHoldById(initialIntent.slotHoldId()).orElse(null);
        if (initialHold == null) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "SLOT_HOLD_NOT_FOUND", now), 0);
            return;
        }

        AppointmentSlotRow slot = schedulingRepository.appointmentSlotByIdForUpdate(initialHold.slotId()).orElse(null);
        if (slot == null) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "SLOT_NOT_FOUND", now), 0);
            return;
        }

        SlotHoldRow hold = schedulingRepository.slotHoldByIdForUpdate(initialHold.id()).orElse(null);
        if (hold == null) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "SLOT_HOLD_NOT_FOUND", now), 0);
            return;
        }

        PaymentIntentRow intent = paymentRepository.paymentIntentByIdForUpdate(initialIntent.id()).orElse(null);
        if (intent == null) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "PAYMENT_INTENT_NOT_FOUND", now), 0);
            return;
        }

        // Out-of-order & State Machine Invariant Protection
        if ("SUCCEEDED".equals(intent.status())) {
            // Already captured and confirmed. Subsequent duplicate or failure events must not revert state.
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            return;
        }

        if ("FAILED".equals(intent.status()) || "CANCELLED".equals(intent.status()) || "RECONCILIATION_REQUIRED".equals(intent.status())) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            return;
        }

        // Provider Failure Event
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
                    "PaymentIntent", intent.id(), intent.version() + 1, "PROVIDER_PAYMENT_FAILED", effectiveCorrelationId, now);
            return;
        }

        // Validate Provider Transaction ID: never fabricate identity
        if (event.providerTransactionId() == null || event.providerTransactionId().isBlank()) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", "MISSING_PROVIDER_TRANSACTION_ID",
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", "MISSING_PROVIDER_TRANSACTION_ID"), effectiveCorrelationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, "MISSING_PROVIDER_TRANSACTION_ID", effectiveCorrelationId, now);
            return;
        }

        // Duplicate Provider Transaction ID check across payments
        Optional<PaymentRow> existingPayment = paymentRepository.paymentByProviderTransactionId(provider, event.providerTransactionId());
        if (existingPayment.isPresent()) {
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "FAILED", "DUPLICATE_PROVIDER_TRANSACTION", now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", "DUPLICATE_PROVIDER_TRANSACTION",
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", "DUPLICATE_PROVIDER_TRANSACTION"), effectiveCorrelationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, "DUPLICATE_PROVIDER_TRANSACTION", effectiveCorrelationId, now);
            return;
        }

        // Amount & Currency mismatch reconciliation
        boolean amountMismatch = event.amount() == null || event.amount().compareTo(intent.amount()) != 0;
        boolean currencyMismatch = !"VND".equalsIgnoreCase(event.currency());
        if (amountMismatch || currencyMismatch) {
            String reason = amountMismatch ? "AMOUNT_MISMATCH" : "CURRENCY_MISMATCH";
            if (event.amount() != null && event.amount().compareTo(BigDecimal.ZERO) > 0) {
                String captureCurrency = event.currency() != null && event.currency().matches("^[A-Z]{3}$") ? event.currency() : "VND";
                paymentRepository.insertPayment(new PaymentRow(
                        ids.next(), intent.id(), provider, event.providerTransactionId(),
                        event.amount(), captureCurrency,
                        "CAPTURED", event.providerOccurredAt(), providerTimeTrust, inbox.id(), now, now));
            }
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", reason,
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", reason), effectiveCorrelationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, reason, effectiveCorrelationId, now);
            return;
        }

        // Provider Time Trust verification
        if (!"TRUSTED".equals(providerTimeTrust)) {
            String reason = "MISSING".equals(providerTimeTrust) ? "MISSING_PROVIDER_TIME" : "UNTRUSTED_PROVIDER_TIME";
            paymentRepository.insertPayment(new PaymentRow(
                    ids.next(), intent.id(), provider, event.providerTransactionId(),
                    intent.amount(), "VND", "CAPTURED", event.providerOccurredAt(),
                    providerTimeTrust, inbox.id(), now, now));
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", reason,
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", reason), effectiveCorrelationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, reason, effectiveCorrelationId, now);
            return;
        }

        // Late Payment: occurred after hold expiry
        if (!event.providerOccurredAt().isBefore(hold.expiresAt())) {
            paymentRepository.insertPayment(new PaymentRow(
                    ids.next(), intent.id(), provider, event.providerTransactionId(),
                    intent.amount(), "VND", "CAPTURED", event.providerOccurredAt(),
                    "TRUSTED", inbox.id(), now, now));
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
                    Map.of("intentId", intent.id().toString(), "reason", "LATE_PAYMENT_AFTER_HOLD_EXPIRY"), effectiveCorrelationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, "LATE_PAYMENT_AFTER_HOLD_EXPIRY", effectiveCorrelationId, now);
            return;
        }

        // Hold Status check
        if (!"ACTIVE".equals(hold.status())) {
            paymentRepository.insertPayment(new PaymentRow(
                    ids.next(), intent.id(), provider, event.providerTransactionId(),
                    intent.amount(), "VND", "CAPTURED", event.providerOccurredAt(),
                    "TRUSTED", inbox.id(), now, now));
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", "HOLD_NOT_ACTIVE",
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", "HOLD_NOT_ACTIVE"), effectiveCorrelationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, "HOLD_NOT_ACTIVE", effectiveCorrelationId, now);
            return;
        }

        // Capacity check
        int activeCount = schedulingRepository.countActiveHoldsAndAppointments(slot.id(), now);
        if (activeCount > slot.capacity()) {
            paymentRepository.insertPayment(new PaymentRow(
                    ids.next(), intent.id(), provider, event.providerTransactionId(),
                    intent.amount(), "VND", "CAPTURED", event.providerOccurredAt(),
                    "TRUSTED", inbox.id(), now, now));
            paymentRepository.updateWebhookInbox(withInboxTerminal(inbox, "PROCESSED", null, now), 0);
            paymentRepository.updatePaymentIntent(new PaymentIntentRow(
                    intent.id(), intent.slotHoldId(), intent.provider(), intent.providerReference(),
                    intent.amount(), intent.currency(), "RECONCILIATION_REQUIRED", "CAPACITY_EXHAUSTED",
                    intent.version() + 1, intent.createdAt(), now), intent.version());
            recordOutbox(intent.id(), "PAYMENT_INTENT", "payment.reconciliation_required.v1",
                    Map.of("intentId", intent.id().toString(), "reason", "CAPACITY_EXHAUSTED"), effectiveCorrelationId, now);
            recordAuditDirect(null, hold.patientId(), "payment.webhook.receive", "FAILED",
                    "PaymentIntent", intent.id(), intent.version() + 1, "CAPACITY_EXHAUSTED", effectiveCorrelationId, now);
            return;
        }

        // Happy Path: Atomic Payment Capture + Intent SUCCEEDED + Hold CONSUMED + Appointment CONFIRMED + Outbox + Audit
        UUID paymentId = ids.next();
        PaymentRow payment = new PaymentRow(
                paymentId,
                intent.id(),
                provider,
                event.providerTransactionId(),
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

        recordOutbox(paymentId, "PAYMENT", "payment.captured.v1", outboxPayload, effectiveCorrelationId, now);

        recordAuditDirect(null, hold.patientId(), "payment.capture", "SUCCEEDED",
                "Payment", paymentId, 0L, "captured", effectiveCorrelationId, now);
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
        payloadMap.put("providerOccurredAt", occurredAt.toString());
        payloadMap.put("providerReference", intent.providerReference());
        payloadMap.put("amount", amount.toPlainString());
        payloadMap.put("currency", currency);

        byte[] rawPayload;
        try {
            rawPayload = objectMapper.writeValueAsBytes(payloadMap);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to serialize mock webhook payload", exception);
        }

        String timestamp = occurredAt.toString();
        String signature = providerAdapter.sign(rawPayload, eventId, timestamp);
        if (Boolean.TRUE.equals(request.corruptSignature())) {
            signature = "v1=0000000000000000000000000000000000000000000000000000000000000000";
        }

        processPaymentWebhook(
                providerAdapter.providerName(),
                rawPayload,
                eventId,
                timestamp,
                signature,
                context.correlationId());
    }

    private static WebhookInboxRow withInboxTerminal(WebhookInboxRow source, String status, String errorCode, Instant processedAt) {
        return new WebhookInboxRow(
                source.id(),
                source.provider(),
                source.eventId(),
                source.eventType(),
                source.providerTransactionId(),
                source.signatureStatus(),
                source.payloadHash(),
                source.rawPayload(),
                source.payload(),
                source.providerOccurredAt(),
                source.receivedAt(),
                source.providerTimeTrust(),
                source.amount(),
                source.currency(),
                status,
                processedAt,
                errorCode,
                source.attempts(),
                source.nextAttemptAt(),
                source.correlationId(),
                source.version() + 1);
    }

    private void recordOutbox(UUID aggregateId, String aggregateType, String eventType, Object payload, String correlationId, Instant now) {
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
