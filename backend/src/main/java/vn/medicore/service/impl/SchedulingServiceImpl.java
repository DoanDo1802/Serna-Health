package vn.medicore.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.AppointmentCancellationException;
import vn.medicore.common.exception.PatientScheduleConflictException;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.PatientModels.Page;
import vn.medicore.dto.PaymentModels.DepositAllocationRow;
import vn.medicore.dto.PaymentModels.OutboxEventRow;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.AppointmentRow;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.BookingAvailabilitySlot;
import vn.medicore.dto.SchedulingModels.BookingCatalog;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.CreateRescheduleSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.PatientAppointment;
import vn.medicore.dto.SchedulingModels.SlotHoldJdbcRow;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.dto.SchedulingModels.UpdateAppointmentSlotRequest;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.repository.PaymentRepository;
import vn.medicore.repository.SchedulingRepository;
import vn.medicore.service.SchedulingService;

@Service
@Transactional
public class SchedulingServiceImpl implements SchedulingService {

    private static final ZoneId HO_CHI_MINH = ZoneId.of("Asia/Ho_Chi_Minh");

    private final SchedulingRepository store;
    private final PaymentRepository paymentRepository;
    private final ObjectMapper objectMapper;
    private final SecurityAuditRecorder audit;
    private final Clock clock;
    private final UuidV7Generator ids;

    public SchedulingServiceImpl(
            SchedulingRepository store,
            PaymentRepository paymentRepository,
            ObjectMapper objectMapper,
            SecurityAuditRecorder audit,
            Clock clock,
            UuidV7Generator ids) {
        this.store = store;
        this.paymentRepository = paymentRepository;
        this.objectMapper = objectMapper;
        this.audit = audit;
        this.clock = clock;
        this.ids = ids;
    }

    @Override
    public AppointmentSlotRow createAppointmentSlot(
            CreateAppointmentSlotRequest request,
            SchedulingAuditContext context) {
        validateSlotRequest(request);
        String date = DateTimeFormatter.ISO_LOCAL_DATE.withZone(HO_CHI_MINH).format(request.startAt());
        store.lockPractitionerDay(request.practitionerRoleId(), date);
        if (store.countActiveSlotsByPractitionerAndDate(request.practitionerRoleId(), date) >= 4) {
            throw new IllegalArgumentException("Practitioner role cannot exceed 4 active slots per day");
        }
        if (store.countActiveSlotsByPractitionerAndSession(request.practitionerRoleId(), date, request.session()) >= 2) {
            throw new IllegalArgumentException("Practitioner role cannot exceed 2 active slots per session");
        }
        Instant now = clock.instant();
        AppointmentSlotRow row = new AppointmentSlotRow(
                ids.next(), request.practitionerRoleId(), request.departmentId(), request.roomId(), request.serviceId(),
                request.session(), request.startAt(), request.endAt(), request.capacity(), "ACTIVE", 0, now, now);
        store.insertAppointmentSlot(row);
        record(context, null, "appointment_slot.create", "SUCCEEDED", "AppointmentSlot", row.id(), row.version(), "created");
        return row;
    }

    @Override
    public AppointmentSlotRow updateAppointmentSlot(
            UUID id,
            UpdateAppointmentSlotRequest request,
            long version,
            SchedulingAuditContext context) {
        if (request.capacity() < 1) throw new IllegalArgumentException("Slot capacity is invalid");
        AppointmentSlotRow existing = store.appointmentSlotByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        requireVersion(existing.version(), version);
        if (!"ACTIVE".equals(existing.status())) throw new IllegalStateException("Only ACTIVE slots can be updated");
        Instant now = clock.instant();
        store.expireActiveHolds(id, now);
        if (request.capacity() < store.countActiveHoldsAndAppointments(id, now)) {
            throw new IllegalStateException("Slot capacity cannot be lower than reservations");
        }
        AppointmentSlotRow updated = new AppointmentSlotRow(
                existing.id(), existing.practitionerRoleId(), existing.departmentId(), existing.roomId(), existing.serviceId(),
                existing.session(), existing.startAt(), existing.endAt(), request.capacity(), existing.status(), version + 1,
                existing.createdAt(), now);
        store.updateAppointmentSlot(updated, version);
        record(context, null, "appointment_slot.update", "SUCCEEDED", "AppointmentSlot", id, updated.version(), "updated");
        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public AppointmentSlotRow getAppointmentSlot(UUID id) {
        return store.appointmentSlotById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AppointmentSlotRow> searchAppointmentSlots(String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.searchAppointmentSlots(limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public BookingCatalog bookingCatalog() {
        return store.bookingCatalog(clock.instant());
    }

    @Override
    public void cancelAppointmentSlot(UUID id, long version, SchedulingAuditContext context) {
        AppointmentSlotRow existing = store.appointmentSlotByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        requireVersion(existing.version(), version);
        if (!"ACTIVE".equals(existing.status())) throw new IllegalStateException("Only ACTIVE slots can be cancelled");
        Instant now = clock.instant();
        store.expireActiveHolds(id, now);
        if (store.countActiveHoldsAndAppointments(id, now) > 0) {
            throw new IllegalStateException("Slot has active reservations");
        }
        AppointmentSlotRow updated = new AppointmentSlotRow(
                existing.id(), existing.practitionerRoleId(), existing.departmentId(), existing.roomId(), existing.serviceId(),
                existing.session(), existing.startAt(), existing.endAt(), existing.capacity(), "CANCELLED", version + 1,
                existing.createdAt(), now);
        store.updateAppointmentSlot(updated, version);
        record(context, null, "appointment_slot.cancel", "SUCCEEDED", "AppointmentSlot", id, updated.version(), "cancelled");
    }

    @Override
    public SlotHoldRow createSlotHold(CreateSlotHoldRequest request, SchedulingAuditContext context) {
        return createSlotHold(request.slotId(), request.patientId(), null, context, "slot_hold.create");
    }

    @Override
    public SlotHoldRow createRescheduleSlotHold(CreateRescheduleSlotHoldRequest request, SchedulingAuditContext context) {
        var initialSourceAppointment = store.appointmentById(request.sourceAppointmentId())
                .orElseThrow(ResourceNotFoundException::new);
        var initialSourceSlot = store.appointmentSlotById(initialSourceAppointment.slotId())
                .orElseThrow(ResourceNotFoundException::new);
        if (initialSourceSlot.id().equals(request.slotId())) {
            throw new PatientScheduleConflictException(
                    "APPOINTMENT_PATIENT_DUPLICATE_SLOT", "Reschedule target cannot be current appointment slot");
        }

        store.lockPatientSchedule(request.patientId());
        List<UUID> slotIds = List.of(initialSourceSlot.id(), request.slotId()).stream().distinct().sorted().toList();
        for (UUID slotId : slotIds) {
            store.appointmentSlotByIdForUpdate(slotId).orElseThrow(ResourceNotFoundException::new);
        }
        var sourceAppointment = store.appointmentByIdForUpdate(request.sourceAppointmentId())
                .orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        if (!sourceAppointment.patientId().equals(request.patientId())) {
            throw new IllegalStateException("Source appointment must belong to the target patient");
        }
        if (!"CONFIRMED".equals(sourceAppointment.status()) || sourceAppointment.rescheduledToId() != null) {
            throw new IllegalStateException("Source appointment cannot be rescheduled");
        }
        if (!now.isBefore(selfServiceCutoff(initialSourceSlot))) {
            throw new vn.medicore.common.exception.RescheduleEligibilityException(
                    "SELF_SERVICE_RESCHEDULE_WINDOW_CLOSED",
                    "Reschedule window has closed for patient self-service");
        }
        return createSlotHold(request.slotId(), request.patientId(), sourceAppointment.id(), context, "slot_hold.reschedule_target.create");
    }

    private SlotHoldRow createSlotHold(
            UUID slotId,
            UUID patientId,
            UUID excludedAppointmentId,
            SchedulingAuditContext context,
            String auditAction) {
        Instant now = clock.instant();
        store.lockPatientSchedule(patientId);
        AppointmentSlotRow slot = store.appointmentSlotByIdForUpdate(slotId).orElseThrow(ResourceNotFoundException::new);
        if (!"ACTIVE".equals(slot.status()) || !slot.startAt().isAfter(now)) {
            throw new IllegalStateException("Slot is unavailable");
        }
        if (excludedAppointmentId != null) {
            var sourceAppointment = store.appointmentByIdForUpdate(excludedAppointmentId).orElseThrow(ResourceNotFoundException::new);
            if (!sourceAppointment.patientId().equals(patientId)
                    || !"CONFIRMED".equals(sourceAppointment.status())
                    || sourceAppointment.rescheduledToId() != null) {
                throw new IllegalStateException("Source appointment cannot be rescheduled");
            }
        }
        store.expireActiveHolds(slot.id(), now);
        if (store.hasPatientScheduleConflict(patientId, slot.startAt(), slot.endAt(), now, excludedAppointmentId, null)) {
            String code = store.hasPatientSlotReservation(patientId, slot.id(), now, excludedAppointmentId, null)
                    ? "APPOINTMENT_PATIENT_DUPLICATE_SLOT"
                    : "APPOINTMENT_PATIENT_TIME_OVERLAP";
            record(context, patientId, auditAction, "DENIED", "AppointmentSlot", slot.id(), slot.version(), code);
            throw new PatientScheduleConflictException(code, "Patient already has a conflicting appointment or active hold");
        }
        if (store.countActiveHoldsAndAppointments(slot.id(), now) >= slot.capacity()) {
            record(context, patientId, auditAction, "DENIED", "AppointmentSlot", slot.id(), slot.version(), "capacity_exhausted");
            throw new IllegalStateException("Slot is fully booked");
        }
        BigDecimal price = store.effectiveServicePrice(slot.serviceId(), now)
                .orElseThrow(() -> new IllegalStateException("Effective service price is required"));
        Instant expiresAt = now.plusSeconds(300);
        if (expiresAt.isAfter(slot.startAt())) {
            expiresAt = slot.startAt();
        }
        SlotHoldJdbcRow row = new SlotHoldJdbcRow(
                ids.next(), slot.id(), patientId, expiresAt, price, "VND",
                null, null, null, "ACTIVE", 0, now, now);
        store.insertSlotHold(row);
        record(context, patientId, auditAction, "SUCCEEDED", "SlotHold", row.id(), row.version(), "created");
        return row.toRow();
    }

    @Override
    @Transactional(readOnly = true)
    public SlotHoldRow getSlotHoldForAccess(UUID id) {
        return store.slotHoldById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public SlotHoldRow getSlotHold(UUID id, SchedulingAuditContext context) {
        SlotHoldRow hold = store.slotHoldByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        if ("ACTIVE".equals(hold.status()) && !hold.expiresAt().isAfter(now)) {
            SlotHoldJdbcRow expired = withStatus(hold, "EXPIRED", hold.version() + 1, now);
            store.updateSlotHold(expired, hold.version());
            record(context, hold.patientId(), "slot_hold.expire", "SUCCEEDED", "SlotHold", expired.id(), expired.version(), "expired");
            return expired.toRow();
        }
        return hold;
    }

    @Override
    public void cancelSlotHold(UUID id, long version, SchedulingAuditContext context) {
        SlotHoldRow hold = getSlotHold(id, context);
        requireVersion(hold.version(), version);
        if (!"ACTIVE".equals(hold.status())) throw new IllegalStateException("Only ACTIVE slot holds can be released");
        SlotHoldJdbcRow released = withStatus(hold, "RELEASED", version + 1, clock.instant());
        store.updateSlotHold(released, version);
        record(context, hold.patientId(), "slot_hold.cancel", "SUCCEEDED", "SlotHold", id, released.version(), "released");
    }

    private static SlotHoldJdbcRow withStatus(SlotHoldRow value, String status, long version, Instant now) {
        return new SlotHoldJdbcRow(
                value.id(), value.slotId(), value.patientId(), value.expiresAt(), value.depositAmount(), value.currency(),
                null, null, null, status, version, value.createdAt(), now);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AppointmentRow> searchAppointments(List<UUID> patientIds, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.searchAppointments(patientIds, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public AppointmentRow getAppointment(UUID appointmentId) {
        return store.appointmentById(appointmentId).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatientAppointment> searchPatientAppointments(List<UUID> patientIds, String cursor, int limit) {
        Instant now = clock.instant();
        int offset = offset(cursor);
        return page(store.searchPatientAppointments(patientIds, now, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public PatientAppointment getPatientAppointment(UUID appointmentId) {
        Instant now = clock.instant();
        return store.patientAppointmentById(appointmentId, now).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BookingAvailabilitySlot> getBookingAvailability(UUID patientId, String cursor, int limit) {
        return bookingAvailability(patientId, null, cursor, limit);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BookingAvailabilitySlot> getRescheduleAvailability(UUID appointmentId, String cursor, int limit) {
        AppointmentRow sourceAppointment = store.appointmentById(appointmentId)
                .orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        AppointmentSlotRow sourceSlot = store.appointmentSlotById(sourceAppointment.slotId())
                .orElseThrow(ResourceNotFoundException::new);
        if (!"CONFIRMED".equals(sourceAppointment.status())
                || sourceAppointment.rescheduledToId() != null
                || !now.isBefore(selfServiceCutoff(sourceSlot))) {
            throw new vn.medicore.common.exception.RescheduleEligibilityException(
                    "SELF_SERVICE_RESCHEDULE_WINDOW_CLOSED",
                    "Reschedule window has closed for patient self-service");
        }
        return bookingAvailability(sourceAppointment.patientId(), sourceAppointment, cursor, limit);
    }

    private Page<BookingAvailabilitySlot> bookingAvailability(
            UUID patientId, AppointmentRow sourceAppointment, String cursor, int limit) {
        Instant now = clock.instant();
        int offset = offset(cursor);
        UUID excludedAppointmentId = sourceAppointment != null ? sourceAppointment.id() : null;
        UUID currentSlotId = sourceAppointment != null ? sourceAppointment.slotId() : null;
        List<BookingAvailabilitySlot> values = store.searchBookingAvailability(
                        patientId, now, excludedAppointmentId, currentSlotId, limit + 1, offset)
                .stream()
                .map(projection -> projection.toSlot())
                .toList();
        return page(values, limit, offset);
    }

    @Override
    public PatientAppointment cancelAppointment(
            UUID appointmentId,
            long expectedVersion,
            String reason,
            SchedulingAuditContext context,
            boolean isStaff) {
        Instant now = clock.instant();

        // 1. Initial lookup
        AppointmentRow appointment = store.appointmentById(appointmentId)
                .orElseThrow(ResourceNotFoundException::new);

        // 2. Strict lock order: lockPatientSchedule -> appointmentByIdForUpdate -> slotHoldByIdForUpdate -> activeDepositAllocationsByAppointmentIdForUpdate
        store.lockPatientSchedule(appointment.patientId());

        AppointmentRow lockedAppt = store.appointmentByIdForUpdate(appointmentId)
                .orElseThrow(ResourceNotFoundException::new);

        if (lockedAppt.version() != expectedVersion) {
            throw new StaleVersionException();
        }

        // 3. Status check: must be cancellable
        if (!"CONFIRMED".equals(lockedAppt.status())) {
            throw new AppointmentCancellationException("APPOINTMENT_NOT_CANCELLABLE",
                    "Appointment cannot be cancelled from status: " + lockedAppt.status());
        }

        // 4. Cutoff check: self-service ends 24h before slot start.
        AppointmentSlotRow slot = store.appointmentSlotById(lockedAppt.slotId())
                .orElseThrow(ResourceNotFoundException::new);
        Instant cutoff = selfServiceCutoff(slot);
        if (!isStaff) {
            if (!now.isBefore(cutoff)) {
                throw new AppointmentCancellationException("SELF_SERVICE_CANCEL_WINDOW_CLOSED",
                        "Self-service cancellation window is closed. Please contact front desk.");
            }
        } else {
            if (reason == null || reason.isBlank()) {
                throw new IllegalArgumentException("Staff cancellation requires a non-blank reason");
            }
        }

        // 5. Lock hold if present
        if (lockedAppt.slotHoldId() != null) {
            store.slotHoldByIdForUpdate(lockedAppt.slotHoldId());
        }

        // 6. Lock active deposit allocations
        List<DepositAllocationRow> activeAllocations =
                store.activeDepositAllocationsByAppointmentIdForUpdate(appointmentId);

        // 7. Transition appointment status to CANCELLED
        AppointmentRow updatedAppt = new AppointmentRow(
                lockedAppt.id(),
                lockedAppt.patientId(),
                lockedAppt.slotHoldId(),
                lockedAppt.slotId(),
                lockedAppt.rescheduledFromId(),
                lockedAppt.rescheduledToId(),
                "CANCELLED",
                lockedAppt.version() + 1,
                lockedAppt.createdAt(),
                now
        );
        store.updateAppointment(updatedAppt, lockedAppt.version());

        // 8. Financial refund workflow
        if (!activeAllocations.isEmpty()) {
            for (DepositAllocationRow alloc : activeAllocations) {
                store.updateDepositAllocationStatus(alloc.id(), "REFUND_PENDING", "ACTIVE");
                recordOutbox(alloc.id(), "DEPOSIT_ALLOCATION", "appointment.cancelled.refund_pending.v1",
                        Map.of(
                                "allocationId", alloc.id().toString(),
                                "appointmentId", appointmentId.toString(),
                                "patientId", lockedAppt.patientId().toString(),
                                "amount", alloc.amount().toPlainString(),
                                "currency", alloc.currency(),
                                "status", "REFUND_PENDING"
                        ), context.correlationId(), now);
            }
        } else {
            recordOutbox(appointmentId, "APPOINTMENT", "appointment.cancelled.v1",
                    Map.of(
                            "appointmentId", appointmentId.toString(),
                            "patientId", lockedAppt.patientId().toString(),
                            "outcome", "NOT_REQUIRED"
                    ), context.correlationId(), now);
        }

        // 9. Platform audit direct
        record(context, lockedAppt.patientId(), "appointment.cancel", "SUCCEEDED",
                "Appointment", appointmentId, updatedAppt.version(), reason);

        return store.patientAppointmentById(appointmentId, now)
                .orElseThrow(ResourceNotFoundException::new);
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

    private static Instant selfServiceCutoff(AppointmentSlotRow slot) {
        return slot.startAt().minus(Duration.ofHours(24));
    }

    private static void requireVersion(long actual, long expected) {
        if (actual != expected) throw new StaleVersionException();
    }

    private static void validateSlotRequest(CreateAppointmentSlotRequest value) {
        if (value == null || value.practitionerRoleId() == null || value.departmentId() == null || value.roomId() == null
                || value.serviceId() == null || !("MORNING".equals(value.session()) || "AFTERNOON".equals(value.session()))
                || value.startAt() == null || value.endAt() == null || !value.endAt().isAfter(value.startAt())
                || value.capacity() < 1) {
            throw new IllegalArgumentException("Appointment slot is invalid");
        }
    }

    private void record(
            SchedulingAuditContext context,
            UUID patientId,
            String action,
            String outcome,
            String type,
            UUID id,
            long version,
            String reason) {
        audit.record(
                context.actorAccountId(), context.permissionSnapshot(), patientId, action, outcome, reason, type, id, version,
                context.sessionId(), context.requestId(), context.correlationId());
    }

    private static int offset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            int value = Integer.parseInt(new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8));
            if (value < 0) throw new IllegalArgumentException("Cursor is invalid");
            return value;
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Cursor is invalid");
        }
    }

    private static <T> Page<T> page(List<T> values, int limit, int offset) {
        boolean hasMore = values.size() > limit;
        List<T> items = hasMore ? values.subList(0, limit) : values;
        String nextCursor = hasMore
                ? Base64.getUrlEncoder().withoutPadding().encodeToString(
                        Integer.toString(offset + items.size()).getBytes(StandardCharsets.UTF_8))
                : null;
        return new Page<>(List.copyOf(items), nextCursor, hasMore);
    }
}
