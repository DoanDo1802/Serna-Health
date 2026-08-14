package vn.medicore.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.AuditModels.AuditEventView;
import vn.medicore.dto.PaymentModels.DepositAllocationRow;
import vn.medicore.dto.PaymentModels.DepositTransferRow;
import vn.medicore.dto.PaymentModels.OutboxEventRow;
import vn.medicore.dto.PaymentModels.PaymentIntentRow;
import vn.medicore.dto.PaymentModels.PaymentRow;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.AppointmentRow;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.RescheduleAppointmentRequest;
import vn.medicore.dto.SchedulingModels.RescheduleAppointmentResponse;
import vn.medicore.dto.SchedulingModels.SlotHoldJdbcRow;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.repository.PaymentRepository;
import vn.medicore.repository.PlatformAuditRepository;
import vn.medicore.repository.SchedulingRepository;
import vn.medicore.service.RescheduleService;

@Service
@Transactional
public class RescheduleServiceImpl implements RescheduleService {

    private final SchedulingRepository schedulingRepository;
    private final PaymentRepository paymentRepository;
    private final PlatformAuditRepository platformAuditRepository;
    private final Clock clock;
    private final UuidV7Generator ids;
    private final ObjectMapper objectMapper;

    public RescheduleServiceImpl(
            SchedulingRepository schedulingRepository,
            PaymentRepository paymentRepository,
            PlatformAuditRepository platformAuditRepository,
            Clock clock,
            UuidV7Generator ids,
            ObjectMapper objectMapper) {
        this.schedulingRepository = schedulingRepository;
        this.paymentRepository = paymentRepository;
        this.platformAuditRepository = platformAuditRepository;
        this.clock = clock;
        this.ids = ids;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public AppointmentRow getAppointmentForAccess(UUID appointmentId) {
        return schedulingRepository.appointmentById(appointmentId)
                .orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public RescheduleAppointmentResponse rescheduleAppointment(
            UUID oldAppointmentId,
            RescheduleAppointmentRequest request,
            long ifMatchVersion,
            SchedulingAuditContext context) {
        Instant now = clock.instant();

        if (request.targetSlotHoldId() == null) {
            throw new IllegalArgumentException("Target slot hold ID is required");
        }

        // 1. Initial lookups (before locking)
        AppointmentRow initialOldAppointment = schedulingRepository.appointmentById(oldAppointmentId)
                .orElseThrow(ResourceNotFoundException::new);

        if (initialOldAppointment.version() != ifMatchVersion) {
            throw new StaleVersionException();
        }
        if (!"CONFIRMED".equals(initialOldAppointment.status()) || initialOldAppointment.rescheduledToId() != null) {
            throw new IllegalStateException("Appointment cannot be rescheduled in status: " + initialOldAppointment.status());
        }

        SlotHoldRow initialOldHold = schedulingRepository.slotHoldById(initialOldAppointment.slotHoldId())
                .orElseThrow(ResourceNotFoundException::new);
        AppointmentSlotRow initialOldSlot = schedulingRepository.appointmentSlotById(initialOldAppointment.slotId())
                .orElseThrow(ResourceNotFoundException::new);

        SlotHoldRow initialTargetHold = schedulingRepository.slotHoldById(request.targetSlotHoldId())
                .orElseThrow(() -> new ResourceNotFoundException("Target slot hold not found"));
        AppointmentSlotRow initialTargetSlot = schedulingRepository.appointmentSlotById(initialTargetHold.slotId())
                .orElseThrow(ResourceNotFoundException::new);

        // Same patient constraint
        if (!initialOldAppointment.patientId().equals(initialTargetHold.patientId())) {
            throw new IllegalStateException("Target slot hold must be for the same patient");
        }

        // 24-hour late reschedule policy: within 24 hours of appointment start time, reason is required
        boolean isWithin24Hours = initialOldSlot.startAt().isBefore(now.plus(Duration.ofHours(24)));
        if (isWithin24Hours) {
            if (request.reason() == null || request.reason().isBlank()) {
                throw new IllegalStateException("Mandatory reason required for rescheduling within 24 hours of appointment start");
            }
        }

        // 2. Deadlock-free global lock order: sorted Slot IDs -> sorted Hold IDs -> Appointment -> Top-up Payment
        List<UUID> sortedSlotIds = Stream.of(initialOldSlot.id(), initialTargetSlot.id()).distinct().sorted().toList();
        for (UUID slotId : sortedSlotIds) {
            schedulingRepository.appointmentSlotByIdForUpdate(slotId);
        }

        List<UUID> sortedHoldIds = Stream.of(initialOldHold.id(), initialTargetHold.id()).distinct().sorted().toList();
        for (UUID holdId : sortedHoldIds) {
            schedulingRepository.slotHoldByIdForUpdate(holdId);
        }

        AppointmentRow oldAppointment = schedulingRepository.appointmentByIdForUpdate(oldAppointmentId)
                .orElseThrow(ResourceNotFoundException::new);
        if (oldAppointment.version() != ifMatchVersion) {
            throw new StaleVersionException();
        }
        if (!"CONFIRMED".equals(oldAppointment.status()) || oldAppointment.rescheduledToId() != null) {
            throw new IllegalStateException("Appointment cannot be rescheduled in status: " + oldAppointment.status());
        }

        SlotHoldRow targetHold = schedulingRepository.slotHoldById(request.targetSlotHoldId())
                .orElseThrow(() -> new ResourceNotFoundException("Target slot hold not found"));
        if (!"ACTIVE".equals(targetHold.status())) {
            throw new IllegalStateException("Target slot hold is not active");
        }
        if (!targetHold.expiresAt().isAfter(now)) {
            SlotHoldJdbcRow expired = new SlotHoldJdbcRow(
                    targetHold.id(), targetHold.slotId(), targetHold.patientId(), targetHold.expiresAt(), targetHold.depositAmount(),
                    targetHold.currency(), null, null, null, "EXPIRED", targetHold.version() + 1, targetHold.createdAt(), now);
            schedulingRepository.updateSlotHold(expired, targetHold.version());
            throw new IllegalStateException("Target slot hold is expired");
        }

        // Check target slot capacity
        schedulingRepository.expireActiveHolds(initialTargetSlot.id(), now);
        int activeCount = schedulingRepository.countActiveHoldsAndAppointments(initialTargetSlot.id(), now);
        if (activeCount > initialTargetSlot.capacity()) {
            throw new IllegalStateException("Target slot capacity exhausted");
        }

        // 3. Resolve source allocation and compute deposit differences
        DepositAllocationRow sourceAllocation = schedulingRepository.activeDepositAllocationByAppointmentId(oldAppointmentId)
                .orElse(null);

        BigDecimal sourceAmount = sourceAllocation != null ? sourceAllocation.amount() : BigDecimal.ZERO;
        BigDecimal targetRequired = targetHold.depositAmount();

        String differenceDisposition;
        BigDecimal differenceAmount;
        PaymentRow topUpPayment = null;

        if (targetRequired.compareTo(sourceAmount) == 0) {
            differenceDisposition = "NONE";
            differenceAmount = BigDecimal.ZERO.setScale(2);
        } else if (targetRequired.compareTo(sourceAmount) > 0) {
            differenceDisposition = "ADDITIONAL_CAPTURE";
            differenceAmount = targetRequired.subtract(sourceAmount).setScale(2);

            if (request.topUpPaymentIntentId() == null) {
                throw new IllegalStateException("Top-up payment intent required for higher target deposit");
            }
            PaymentIntentRow topUpIntent = paymentRepository.paymentIntentByIdForUpdate(request.topUpPaymentIntentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Top-up payment intent not found"));

            if (!"SUCCEEDED".equals(topUpIntent.status())) {
                throw new IllegalStateException("Top-up payment intent is not in SUCCEEDED status: " + topUpIntent.status());
            }
            if (!topUpIntent.slotHoldId().equals(targetHold.id())) {
                throw new IllegalStateException("Top-up payment intent does not match target slot hold");
            }
            if (topUpIntent.amount().compareTo(differenceAmount) != 0) {
                throw new IllegalStateException("Top-up payment intent amount mismatch: expected " + differenceAmount + " but was " + topUpIntent.amount());
            }

            topUpPayment = paymentRepository.paymentByIntentId(topUpIntent.id())
                    .orElseThrow(() -> new IllegalStateException("Captured top-up payment record not found"));
            if (!"CAPTURED".equals(topUpPayment.status())) {
                throw new IllegalStateException("Top-up payment is not captured");
            }
        } else {
            differenceDisposition = "REFUND_PENDING";
            differenceAmount = sourceAmount.subtract(targetRequired).setScale(2);
        }

        // 4. Atomic Execution: Lineage creation + Hold consumption + Allocation transitions + Transfer record
        UUID newAppointmentId = ids.next();
        long newAppointmentVersion = 0L;
        long newOldAppointmentVersion = oldAppointment.version() + 1;

        // New appointment -> CONFIRMED with reciprocal link from old appointment
        AppointmentRow newAppointment = new AppointmentRow(
                newAppointmentId,
                oldAppointment.patientId(),
                targetHold.id(),
                initialTargetSlot.id(),
                oldAppointment.id(),
                null,
                "CONFIRMED",
                newAppointmentVersion,
                now,
                now);
        schedulingRepository.insertAppointment(newAppointment);

        // Old appointment -> RESCHEDULED with reciprocal link to new appointment
        AppointmentRow updatedOldAppointment = new AppointmentRow(
                oldAppointment.id(),
                oldAppointment.patientId(),
                oldAppointment.slotHoldId(),
                oldAppointment.slotId(),
                oldAppointment.rescheduledFromId(),
                newAppointmentId,
                "RESCHEDULED",
                newOldAppointmentVersion,
                oldAppointment.createdAt(),
                now);
        schedulingRepository.updateAppointment(updatedOldAppointment, oldAppointment.version());

        // Consume target hold
        SlotHoldJdbcRow consumedTargetHold = new SlotHoldJdbcRow(
                targetHold.id(), targetHold.slotId(), targetHold.patientId(), targetHold.expiresAt(), targetHold.depositAmount(),
                targetHold.currency(), null, null, null, "CONSUMED", targetHold.version() + 1, targetHold.createdAt(), now);
        schedulingRepository.updateSlotHold(consumedTargetHold, targetHold.version());

        UUID depositTransferId = ids.next();
        UUID targetAllocationId = null;
        UUID refundPendingAllocationId = null;
        BigDecimal transferredAmount = targetRequired.min(sourceAmount);

        if (sourceAllocation != null) {
            // Transition source allocation: ACTIVE -> TRANSFERRED
            schedulingRepository.updateDepositAllocationStatus(sourceAllocation.id(), "TRANSFERRED", "ACTIVE");

            // Target transfer allocation: TRANSFER_IN
            targetAllocationId = ids.next();
            DepositAllocationRow targetAllocation = new DepositAllocationRow(
                    targetAllocationId,
                    sourceAllocation.paymentId(),
                    newAppointmentId,
                    transferredAmount,
                    "VND",
                    "TRANSFER_IN",
                    sourceAllocation.id(),
                    "ACTIVE",
                    now,
                    context.correlationId());
            schedulingRepository.insertDepositAllocation(targetAllocation);

            // If additional capture: top-up payment gets ORIGINAL allocation on new appointment
            if ("ADDITIONAL_CAPTURE".equals(differenceDisposition) && topUpPayment != null) {
                UUID topUpAllocationId = ids.next();
                DepositAllocationRow topUpAllocation = new DepositAllocationRow(
                        topUpAllocationId,
                        topUpPayment.id(),
                        newAppointmentId,
                        differenceAmount,
                        "VND",
                        "ORIGINAL",
                        null,
                        "ACTIVE",
                        now,
                        context.correlationId());
                schedulingRepository.insertDepositAllocation(topUpAllocation);
            }

            // If lower deposit: excess funding becomes REFUND_PENDING allocation on old appointment
            if ("REFUND_PENDING".equals(differenceDisposition)) {
                refundPendingAllocationId = ids.next();
                DepositAllocationRow refundAllocation = new DepositAllocationRow(
                        refundPendingAllocationId,
                        sourceAllocation.paymentId(),
                        oldAppointment.id(),
                        differenceAmount,
                        "VND",
                        "TRANSFER_IN",
                        sourceAllocation.id(),
                        "REFUND_PENDING",
                        now,
                        context.correlationId());
                schedulingRepository.insertDepositAllocation(refundAllocation);

                Map<String, Object> refundOutbox = new LinkedHashMap<>();
                refundOutbox.put("refundAllocationId", refundPendingAllocationId.toString());
                refundOutbox.put("oldAppointmentId", oldAppointment.id().toString());
                refundOutbox.put("paymentId", sourceAllocation.paymentId().toString());
                refundOutbox.put("refundAmount", differenceAmount.toPlainString());
                refundOutbox.put("currency", "VND");
                refundOutbox.put("createdAt", now.toString());
                recordOutbox(refundPendingAllocationId, "PAYMENT", "payment.refund_pending.v1", refundOutbox, context.correlationId(), now);
            }

            // DepositTransfer record
            DepositTransferRow depositTransfer = new DepositTransferRow(
                    depositTransferId,
                    oldAppointment.id(),
                    newAppointmentId,
                    sourceAllocation.id(),
                    targetAllocationId,
                    transferredAmount,
                    "VND",
                    differenceAmount,
                    differenceDisposition,
                    context.actorAccountId(),
                    request.reason(),
                    context.correlationId(),
                    now);
            schedulingRepository.insertDepositTransfer(depositTransfer);
        }

        // Outbox event for appointment reschedule
        Map<String, Object> rescheduleOutbox = new LinkedHashMap<>();
        rescheduleOutbox.put("oldAppointmentId", oldAppointment.id().toString());
        rescheduleOutbox.put("newAppointmentId", newAppointmentId.toString());
        rescheduleOutbox.put("patientId", oldAppointment.patientId().toString());
        rescheduleOutbox.put("oldSlotId", initialOldSlot.id().toString());
        rescheduleOutbox.put("newSlotId", initialTargetSlot.id().toString());
        rescheduleOutbox.put("depositTransferId", depositTransferId.toString());
        rescheduleOutbox.put("transferredAmount", transferredAmount.toPlainString());
        rescheduleOutbox.put("differenceDisposition", differenceDisposition);
        rescheduleOutbox.put("rescheduledAt", now.toString());
        recordOutbox(newAppointmentId, "APPOINTMENT", "appointment.rescheduled.v1", rescheduleOutbox, context.correlationId(), now);

        // Platform audit logging
        recordAudit(context, oldAppointment.patientId(), "appointment.reschedule", "SUCCEEDED", "Appointment",
                newAppointmentId, newAppointmentVersion, "rescheduled_from:" + oldAppointment.id(), now);

        return new RescheduleAppointmentResponse(
                oldAppointment.id(),
                newAppointmentId,
                newOldAppointmentVersion,
                newAppointmentVersion,
                depositTransferId,
                sourceAllocation != null ? sourceAllocation.id() : null,
                targetAllocationId,
                transferredAmount,
                differenceAmount,
                differenceDisposition,
                refundPendingAllocationId,
                "VND",
                now);
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
}
