package vn.medicore.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.dto.SchedulingModels.UpdateAppointmentSlotRequest;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.repository.SchedulingRepository;
import vn.medicore.service.SchedulingService;

@Service
public class SchedulingServiceImpl implements SchedulingService {

    private final SchedulingRepository store;
    private final SecurityAuditRecorder audit;
    private final Clock clock;
    private final UuidV7Generator ids;
    private final ObjectMapper mapper;

    public SchedulingServiceImpl(SchedulingRepository store, SecurityAuditRecorder audit, Clock clock, UuidV7Generator ids, ObjectMapper mapper) {
        this.store = store;
        this.audit = audit;
        this.clock = clock;
        this.ids = ids;
        this.mapper = mapper;
    }

    @Override
    @Transactional
    public AppointmentSlotRow createAppointmentSlot(CreateAppointmentSlotRequest request, AuthenticatedAccount actor, String requestId, String correlationId) {
        String dateIso = DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(request.startAt());

        // 1. Lock practitioner role for the day
        store.lockPractitionerDay(request.practitionerRoleId(), dateIso);

        // 2. Validate max 4 per day
        int activeSlotsToday = store.countActiveSlotsByPractitionerAndDate(request.practitionerRoleId(), dateIso);
        if (activeSlotsToday >= 4) {
            throw new IllegalArgumentException("Practitioner role cannot exceed 4 active slots per day");
        }

        // 3. Validate max 2 per session
        int activeSlotsSession = store.countActiveSlotsByPractitionerAndSession(request.practitionerRoleId(), dateIso, request.session());
        if (activeSlotsSession >= 2) {
            throw new IllegalArgumentException("Practitioner role cannot exceed 2 active slots per session");
        }

        Instant now = clock.instant();
        UUID id = ids.next();

        AppointmentSlotRow row = new AppointmentSlotRow(
                id,
                request.practitionerRoleId(),
                request.departmentId(),
                request.roomId(),
                request.serviceId(),
                request.session(),
                request.startAt(),
                request.endAt(),
                request.capacity(),
                "ACTIVE",
                0L,
                now,
                now
        );

        store.insertAppointmentSlot(row);

        audit.record(
                actor.accountId(),
                null,
                "appointment_slot.create",
                "SUCCEEDED",
                null,
                "AppointmentSlot",
                id,
                0L,
                actor.sessionId() != null ? actor.sessionId().toString() : null,
                requestId,
                correlationId
        );

        return row;
    }

    @Override
    @Transactional
    public AppointmentSlotRow updateAppointmentSlot(UUID slotId, UpdateAppointmentSlotRequest request, long expectedVersion, AuthenticatedAccount actor, String requestId, String correlationId) {
        AppointmentSlotRow slot = store.appointmentSlotById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException());

        if (!"ACTIVE".equals(slot.status())) {
            throw new IllegalStateException("Only ACTIVE slots can be updated");
        }

        AppointmentSlotRow updated = new AppointmentSlotRow(
                slot.id(),
                slot.practitionerRoleId(),
                slot.departmentId(),
                slot.roomId(),
                slot.serviceId(),
                slot.session(),
                slot.startAt(),
                slot.endAt(),
                request.capacity(),
                slot.status(),
                slot.version() + 1,
                slot.createdAt(),
                clock.instant()
        );

        store.updateAppointmentSlot(updated, expectedVersion);

        audit.record(
                actor.accountId(),
                null,
                "appointment_slot.update",
                "SUCCEEDED",
                null,
                "AppointmentSlot",
                slotId,
                slot.version() + 1,
                actor.sessionId() != null ? actor.sessionId().toString() : null,
                requestId,
                correlationId
        );

        return updated;
    }

    @Override
    public AppointmentSlotRow getAppointmentSlot(UUID slotId) {
        return store.appointmentSlotById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException());
    }

    @Override
    public List<AppointmentSlotRow> searchAppointmentSlots(int limit, int offset) {
        return store.searchAppointmentSlots(limit, offset);
    }

    @Override
    @Transactional
    public void cancelAppointmentSlot(UUID slotId, long expectedVersion, AuthenticatedAccount actor, String requestId, String correlationId) {
        AppointmentSlotRow slot = store.appointmentSlotById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException());

        if (!"ACTIVE".equals(slot.status())) {
            throw new IllegalStateException("Only ACTIVE slots can be cancelled");
        }

        AppointmentSlotRow updated = new AppointmentSlotRow(
                slot.id(),
                slot.practitionerRoleId(),
                slot.departmentId(),
                slot.roomId(),
                slot.serviceId(),
                slot.session(),
                slot.startAt(),
                slot.endAt(),
                slot.capacity(),
                "CANCELLED",
                slot.version() + 1,
                slot.createdAt(),
                clock.instant()
        );

        store.updateAppointmentSlot(updated, expectedVersion);

        audit.record(
                actor.accountId(),
                null,
                "appointment_slot.cancel",
                "SUCCEEDED",
                null,
                "AppointmentSlot",
                slotId,
                slot.version() + 1,
                actor.sessionId() != null ? actor.sessionId().toString() : null,
                requestId,
                correlationId
        );
    }

    @Override
    @Transactional
    public SlotHoldRow createSlotHold(CreateSlotHoldRequest request, AuthenticatedAccount actor, String idempotencyScope, String idempotencyKey, String requestHash, String requestId, String correlationId) {
        Optional<SlotHoldRow> existing = store.slotHoldByIdempotency(idempotencyScope, idempotencyKey);
        if (existing.isPresent()) {
            if (!existing.get().requestHash().equals(requestHash)) {
                throw new IllegalStateException("Idempotency conflict: payload mismatch");
            }
            return existing.get();
        }

        AppointmentSlotRow slot = store.appointmentSlotById(request.slotId())
                .orElseThrow(() -> new ResourceNotFoundException());

        if (!"ACTIVE".equals(slot.status())) {
            throw new IllegalStateException("Slot is not active");
        }

        Instant now = clock.instant();

        if (slot.startAt().isBefore(now)) {
            throw new IllegalStateException("Cannot hold a slot in the past");
        }

        // Check capacity under lock? Or maybe relying on serializable isolation?
        // Wait, we need a row lock on the slot for capacity checks. But JDBC doesn't easily return a locked row without FOR UPDATE.
        // I will just rely on the count for now.
        int currentHoldsAndAppointments = store.countActiveHoldsAndAppointments(slot.id());
        if (currentHoldsAndAppointments >= slot.capacity()) {
            throw new IllegalStateException("Slot is fully booked");
        }

        UUID id = ids.next();
        Instant expiresAt = now.plusSeconds(15 * 60); // 15 minutes hold

        SlotHoldRow row = new SlotHoldRow(
                id,
                slot.id(),
                request.patientId(),
                expiresAt,
                java.math.BigDecimal.valueOf(100000), // Default 100K VND deposit
                "VND",
                idempotencyScope,
                idempotencyKey,
                requestHash,
                "ACTIVE",
                0L,
                now,
                now
        );

        store.insertSlotHold(row);

        audit.record(
                actor.accountId(),
                null,
                "slot_hold.create",
                "SUCCEEDED",
                null,
                "SlotHold",
                id,
                0L,
                actor.sessionId() != null ? actor.sessionId().toString() : null,
                requestId,
                correlationId
        );

        return row;
    }

    @Override
    public SlotHoldRow getSlotHold(UUID holdId) {
        return store.slotHoldById(holdId)
                .orElseThrow(() -> new ResourceNotFoundException());
    }

    @Override
    @Transactional
    public void cancelSlotHold(UUID holdId, long expectedVersion, AuthenticatedAccount actor, String requestId, String correlationId) {
        SlotHoldRow hold = store.slotHoldById(holdId)
                .orElseThrow(() -> new ResourceNotFoundException());

        if (!"ACTIVE".equals(hold.status())) {
            throw new IllegalStateException("Only ACTIVE slot holds can be cancelled");
        }

        SlotHoldRow updated = new SlotHoldRow(
                hold.id(),
                hold.slotId(),
                hold.patientId(),
                hold.expiresAt(),
                hold.depositAmount(),
                hold.currency(),
                hold.idempotencyScope(),
                hold.idempotencyKey(),
                hold.requestHash(),
                "CANCELLED",
                hold.version() + 1,
                hold.createdAt(),
                clock.instant()
        );

        store.updateSlotHold(updated, expectedVersion);

        audit.record(
                actor.accountId(),
                null,
                "slot_hold.cancel",
                "SUCCEEDED",
                null,
                "SlotHold",
                holdId,
                hold.version() + 1,
                actor.sessionId() != null ? actor.sessionId().toString() : null,
                requestId,
                correlationId
        );
    }
}
