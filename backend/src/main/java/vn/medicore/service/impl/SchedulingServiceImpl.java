package vn.medicore.service.impl;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.PatientModels.Page;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.BookingCatalog;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.SlotHoldJdbcRow;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.dto.SchedulingModels.UpdateAppointmentSlotRequest;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.repository.SchedulingRepository;
import vn.medicore.service.SchedulingService;

@Service
@Transactional
public class SchedulingServiceImpl implements SchedulingService {

    private static final BigDecimal MAX_DEPOSIT = new BigDecimal("100000.00");
    private static final ZoneId HO_CHI_MINH = ZoneId.of("Asia/Ho_Chi_Minh");

    private final SchedulingRepository store;
    private final SecurityAuditRecorder audit;
    private final Clock clock;
    private final UuidV7Generator ids;

    public SchedulingServiceImpl(
            SchedulingRepository store,
            SecurityAuditRecorder audit,
            Clock clock,
            UuidV7Generator ids) {
        this.store = store;
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
        Instant now = clock.instant();
        AppointmentSlotRow slot = store.appointmentSlotByIdForUpdate(request.slotId()).orElseThrow(ResourceNotFoundException::new);
        if (!"ACTIVE".equals(slot.status()) || !slot.startAt().isAfter(now)) {
            throw new IllegalStateException("Slot is unavailable");
        }
        store.expireActiveHolds(slot.id(), now);
        if (store.countActiveHoldsAndAppointments(slot.id(), now) >= slot.capacity()) {
            record(context, request.patientId(), "slot_hold.create", "DENIED", "AppointmentSlot", slot.id(), slot.version(),
                    "capacity_exhausted");
            throw new IllegalStateException("Slot is fully booked");
        }
        BigDecimal price = store.effectiveServicePrice(slot.serviceId(), now)
                .orElseThrow(() -> new IllegalStateException("Effective service price is required"));
        SlotHoldJdbcRow row = new SlotHoldJdbcRow(
                ids.next(), slot.id(), request.patientId(), now.plusSeconds(300), price.min(MAX_DEPOSIT), "VND",
                null, null, null, "ACTIVE", 0, now, now);
        store.insertSlotHold(row);
        record(context, request.patientId(), "slot_hold.create", "SUCCEEDED", "SlotHold", row.id(), row.version(), "created");
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
