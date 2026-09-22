package vn.medicore.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
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
import vn.medicore.dto.SchedulingModels.RescheduleCatalog;
import vn.medicore.dto.SchedulingModels.BookingHoldAssignment;
import vn.medicore.dto.SchedulingModels.BookingSessionAvailability;
import vn.medicore.dto.SchedulingModels.BookingSessionRow;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.CreateBookingSessionHoldRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldResponse;
import vn.medicore.dto.SchedulingModels.CreateWorkScheduleRequest;
import vn.medicore.dto.SchedulingModels.UpdateWorkScheduleRequest;
import vn.medicore.dto.SchedulingModels.WorkScheduleCandidate;
import vn.medicore.dto.SchedulingModels.WorkScheduleCatalog;
import vn.medicore.dto.SchedulingModels.WorkScheduleRow;
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
    private static final BigDecimal MAX_DEPOSIT = new BigDecimal("100000.00");

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
    @Transactional(readOnly = true)
    public RescheduleCatalog rescheduleCatalog() {
        return store.rescheduleCatalog(clock.instant());
    }

    @Override
    @Transactional(readOnly = true)
    public WorkScheduleCatalog workScheduleCatalog() {
        return store.workScheduleCatalog(clock.instant());
    }

    @Override
    public WorkScheduleRow createWorkSchedule(CreateWorkScheduleRequest request, SchedulingAuditContext context) {
        validateWorkScheduleRequest(request);
        Instant now = clock.instant();
        SessionWindow window = sessionWindow(request.localDate(), request.session());
        if (!window.startAt().isAfter(now)) throw new IllegalArgumentException("Work schedule must be in the future");
        if (!store.isWorkScheduleConfigurationAvailable(
                request.practitionerRoleId(), request.departmentId(), request.roomId(), request.serviceId(), now)) {
            throw new IllegalArgumentException("Work schedule configuration is unavailable");
        }

        String date = request.localDate().toString();
        store.lockPractitionerDay(request.practitionerRoleId(), date);
        if (store.countActiveSlotsByPractitionerAndDate(request.practitionerRoleId(), date) >= 4) {
            throw new IllegalArgumentException("Practitioner role cannot exceed 4 active slots per day");
        }
        if (store.countActiveSlotsByPractitionerAndSession(request.practitionerRoleId(), date, request.session()) >= 2) {
            throw new IllegalArgumentException("Practitioner role cannot exceed 2 active slots per session");
        }

        store.lockBookingSessionBucket(request.departmentId(), request.serviceId(), request.localDate(), request.session());
        BookingSessionRow bookingSession = store.activeBookingSessionByBucketForUpdate(
                        request.departmentId(), request.serviceId(), request.localDate(), request.session())
                .orElseGet(() -> {
                    BookingSessionRow created = new BookingSessionRow(ids.next(), request.departmentId(), request.serviceId(),
                            request.localDate(), request.session(), window.startAt(), window.endAt(), "ACTIVE", 0, now, now);
                    store.insertBookingSession(created);
                    return created;
                });
        if (!bookingSession.startAt().equals(window.startAt()) || !bookingSession.endAt().equals(window.endAt())) {
            throw new IllegalStateException("Booking session window is inconsistent");
        }

        WorkScheduleRow schedule = new WorkScheduleRow(ids.next(), bookingSession.id(), request.practitionerRoleId(), request.roomId(),
                request.capacity(), "ACTIVE", 0, now, now, null, 0, request.capacity(),
                request.departmentId(), request.serviceId(), request.localDate(), request.session());
        store.insertWorkSchedule(schedule);
        AppointmentSlotRow slot = new AppointmentSlotRow(ids.next(), request.practitionerRoleId(), request.departmentId(), request.roomId(),
                request.serviceId(), request.session(), window.startAt(), window.endAt(), request.capacity(), "ACTIVE", 0, now, now);
        store.insertAppointmentSlot(slot);
        store.linkAppointmentSlotToWorkSchedule(slot.id(), schedule.id());
        WorkScheduleRow value = new WorkScheduleRow(schedule.id(), schedule.bookingSessionId(), schedule.practitionerRoleId(),
                schedule.roomId(), schedule.capacity(), schedule.status(), schedule.version(), schedule.createdAt(), schedule.updatedAt(),
                slot.id(), 0, schedule.capacity(), schedule.departmentId(), schedule.serviceId(), schedule.localDate(), schedule.session());
        record(context, null, "work_schedule.create", "SUCCEEDED", "WorkSchedule", value.id(), value.version(), "created");
        return value;
    }

    @Override
    public WorkScheduleRow updateWorkSchedule(UUID id, UpdateWorkScheduleRequest request, long expectedVersion,
            SchedulingAuditContext context) {
        Instant now = clock.instant();
        WorkScheduleRow existing = store.workScheduleByIdForUpdate(id, now).orElseThrow(ResourceNotFoundException::new);
        requireVersion(existing.version(), expectedVersion);
        if (!"ACTIVE".equals(existing.status())) throw new IllegalStateException("Only ACTIVE work schedules can be updated");

        AppointmentSlotRow slot = store.appointmentSlotByIdForUpdate(existing.slotId()).orElseThrow(ResourceNotFoundException::new);
        store.expireActiveHolds(slot.id(), now);
        int reserved = store.countActiveHoldsAndAppointments(slot.id(), now);

        int targetCapacity = request.capacity() != null ? request.capacity() : existing.capacity();
        if (targetCapacity < 1 || targetCapacity > 100) {
            throw new IllegalArgumentException("Work schedule capacity is invalid");
        }
        if (targetCapacity < reserved) {
            throw new IllegalStateException("Work schedule capacity cannot be lower than reservations");
        }

        UUID targetRoleId = request.practitionerRoleId() != null ? request.practitionerRoleId() : existing.practitionerRoleId();
        UUID targetDepartmentId = request.departmentId() != null ? request.departmentId() : existing.departmentId();
        UUID targetRoomId = request.roomId() != null ? request.roomId() : existing.roomId();
        UUID targetServiceId = request.serviceId() != null ? request.serviceId() : existing.serviceId();
        LocalDate targetLocalDate = request.localDate() != null ? request.localDate() : existing.localDate();
        String targetSession = request.session() != null ? request.session() : existing.session();
        if (!isSession(targetSession)) throw new IllegalArgumentException("Session is invalid");

        boolean roleChanged = !targetRoleId.equals(existing.practitionerRoleId());
        boolean deptChanged = !targetDepartmentId.equals(existing.departmentId());
        boolean roomChanged = !targetRoomId.equals(existing.roomId());
        boolean serviceChanged = !targetServiceId.equals(existing.serviceId());
        boolean dateChanged = !targetLocalDate.equals(existing.localDate());
        boolean sessionChanged = !targetSession.equals(existing.session());

        if (reserved > 0 && (roleChanged || deptChanged || serviceChanged || dateChanged || sessionChanged)) {
            throw new IllegalStateException("Cannot modify doctor, department, service, date, or session when schedule has active reservations");
        }

        SessionWindow targetWindow = sessionWindow(targetLocalDate, targetSession);
        if ((dateChanged || sessionChanged) && !targetWindow.startAt().isAfter(now)) {
            throw new IllegalArgumentException("Work schedule must be in the future");
        }

        if (roleChanged || deptChanged || roomChanged || serviceChanged) {
            if (!store.isWorkScheduleConfigurationAvailable(targetRoleId, targetDepartmentId, targetRoomId, targetServiceId, now)) {
                throw new IllegalArgumentException("Work schedule configuration is unavailable");
            }
        }

        if (roleChanged || dateChanged || sessionChanged) {
            String date = targetLocalDate.toString();
            store.lockPractitionerDay(targetRoleId, date);
            int activeSlotsForDate = store.countActiveSlotsByPractitionerAndDate(targetRoleId, date);
            boolean sameRoleAndDate = !roleChanged && !dateChanged;
            if (activeSlotsForDate >= (sameRoleAndDate ? 5 : 4)) {
                throw new IllegalArgumentException("Practitioner role cannot exceed 4 active slots per day");
            }
            int activeSlotsForSession = store.countActiveSlotsByPractitionerAndSession(targetRoleId, date, targetSession);
            boolean sameRoleDateSession = !roleChanged && !dateChanged && !sessionChanged;
            if (activeSlotsForSession >= (sameRoleDateSession ? 3 : 2)) {
                throw new IllegalArgumentException("Practitioner role cannot exceed 2 active slots per session");
            }
        }

        UUID targetBookingSessionId;
        if (deptChanged || serviceChanged || dateChanged || sessionChanged) {
            store.lockBookingSessionBucket(targetDepartmentId, targetServiceId, targetLocalDate, targetSession);
            BookingSessionRow bookingSession = store.activeBookingSessionByBucketForUpdate(
                            targetDepartmentId, targetServiceId, targetLocalDate, targetSession)
                    .orElseGet(() -> {
                        BookingSessionRow created = new BookingSessionRow(ids.next(), targetDepartmentId, targetServiceId,
                                targetLocalDate, targetSession, targetWindow.startAt(), targetWindow.endAt(), "ACTIVE", 0, now, now);
                        store.insertBookingSession(created);
                        return created;
                    });
            if (!bookingSession.startAt().equals(targetWindow.startAt()) || !bookingSession.endAt().equals(targetWindow.endAt())) {
                throw new IllegalStateException("Booking session window is inconsistent");
            }
            targetBookingSessionId = bookingSession.id();
        } else {
            targetBookingSessionId = existing.bookingSessionId();
        }

        WorkScheduleRow updated = new WorkScheduleRow(
                existing.id(),
                targetBookingSessionId,
                targetRoleId,
                targetRoomId,
                targetCapacity,
                existing.status(),
                expectedVersion + 1,
                existing.createdAt(),
                now,
                existing.slotId(),
                existing.reservedCapacity(),
                Math.max(0, targetCapacity - existing.reservedCapacity()),
                targetDepartmentId,
                targetServiceId,
                targetLocalDate,
                targetSession
        );
        store.updateWorkSchedule(updated, expectedVersion);

        AppointmentSlotRow updatedSlot = new AppointmentSlotRow(
                slot.id(),
                targetRoleId,
                targetDepartmentId,
                targetRoomId,
                targetServiceId,
                targetSession,
                targetWindow.startAt(),
                targetWindow.endAt(),
                targetCapacity,
                slot.status(),
                slot.version() + 1,
                slot.createdAt(),
                now
        );
        store.updateAppointmentSlot(updatedSlot, slot.version());
        record(context, null, "work_schedule.update", "SUCCEEDED", "WorkSchedule", id, updated.version(), "updated");
        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public WorkScheduleRow getWorkSchedule(UUID id) {
        return store.workScheduleById(id, clock.instant()).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<WorkScheduleRow> searchWorkSchedules(LocalDate fromDate, LocalDate toDate, String cursor, int limit) {
        if (fromDate != null && toDate != null && toDate.isBefore(fromDate)) {
            throw new IllegalArgumentException("Schedule date range is invalid");
        }
        int offset = offset(cursor);
        return page(store.searchWorkSchedules(fromDate, toDate, limit + 1, offset, clock.instant()), limit, offset);
    }

    @Override
    public void cancelWorkSchedule(UUID id, long expectedVersion, SchedulingAuditContext context) {
        Instant now = clock.instant();
        WorkScheduleRow existing = store.workScheduleByIdForUpdate(id, now).orElseThrow(ResourceNotFoundException::new);
        requireVersion(existing.version(), expectedVersion);
        if (!"ACTIVE".equals(existing.status())) throw new IllegalStateException("Only ACTIVE work schedules can be cancelled");
        AppointmentSlotRow slot = store.appointmentSlotByIdForUpdate(existing.slotId()).orElseThrow(ResourceNotFoundException::new);
        store.expireActiveHolds(slot.id(), now);
        if (store.countActiveHoldsAndAppointments(slot.id(), now) > 0) {
            throw new IllegalStateException("Work schedule has active reservations");
        }
        WorkScheduleRow cancelled = new WorkScheduleRow(existing.id(), existing.bookingSessionId(), existing.practitionerRoleId(), existing.roomId(),
                existing.capacity(), "CANCELLED", expectedVersion + 1, existing.createdAt(), now, existing.slotId(), 0, existing.capacity(),
                existing.departmentId(), existing.serviceId(), existing.localDate(), existing.session());
        store.updateWorkSchedule(cancelled, expectedVersion);
        AppointmentSlotRow cancelledSlot = new AppointmentSlotRow(slot.id(), slot.practitionerRoleId(), slot.departmentId(), slot.roomId(),
                slot.serviceId(), slot.session(), slot.startAt(), slot.endAt(), slot.capacity(), "CANCELLED", slot.version() + 1,
                slot.createdAt(), now);
        store.updateAppointmentSlot(cancelledSlot, slot.version());
        record(context, null, "work_schedule.cancel", "SUCCEEDED", "WorkSchedule", id, cancelled.version(), "cancelled");
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
    public CreateSlotHoldResponse createBookingSessionHold(
            CreateBookingSessionHoldRequest request, SchedulingAuditContext context) {
        if (request.bookingSessionId() == null || request.patientId() == null) {
            throw new IllegalArgumentException("Booking session hold request is invalid");
        }
        Instant now = clock.instant();
        store.lockPatientSchedule(request.patientId());
        BookingSessionRow session = store.activeBookingSessionByIdForUpdate(request.bookingSessionId())
                .orElseThrow(ResourceNotFoundException::new);
        if (!session.startAt().isAfter(now)) throw new IllegalStateException("Booking session is unavailable");

        List<WorkScheduleCandidate> candidates = store.workScheduleCandidatesForBookingSession(session.id(), now);
        for (WorkScheduleCandidate candidate : candidates) {
            store.expireActiveHolds(candidate.slot().id(), now);
        }
        if (store.hasPatientScheduleConflict(request.patientId(), session.startAt(), session.endAt(), now, null, null)) {
            record(context, request.patientId(), "slot_hold.create", "DENIED", "BookingSession", session.id(), session.version(),
                    "APPOINTMENT_PATIENT_TIME_OVERLAP");
            throw new PatientScheduleConflictException("APPOINTMENT_PATIENT_TIME_OVERLAP",
                    "Patient already has a conflicting appointment or active hold");
        }
        List<CandidateUsage> availableCandidates = candidates.stream()
                .map(candidate -> new CandidateUsage(candidate,
                        store.countActiveHoldsAndAppointments(candidate.slot().id(), now)))
                .filter(candidate -> candidate.usedCapacity() < candidate.candidate().slot().capacity())
                .toList();
        WorkScheduleCandidate selected = availableCandidates.stream()
                .min(java.util.Comparator
                        .comparingDouble((CandidateUsage candidate) ->
                                (double) candidate.usedCapacity() / candidate.candidate().slot().capacity())
                        .thenComparingInt(CandidateUsage::usedCapacity)
                        .thenComparing(candidate -> candidate.candidate().slot().startAt())
                        .thenComparing(candidate -> candidate.candidate().slot().practitionerRoleId())
                        .thenComparing(candidate -> candidate.candidate().slot().id()))
                .map(CandidateUsage::candidate)
                .orElseThrow(() -> {
                    record(context, request.patientId(), "slot_hold.create", "DENIED", "BookingSession", session.id(),
                            session.version(), "capacity_exhausted");
                    return new IllegalStateException("Booking session is fully booked");
                });
        SlotHoldRow hold = createSlotHoldOnLockedSlot(selected.slot(), request.patientId(), null, context, "slot_hold.create");
        return new CreateSlotHoldResponse(hold.id(), hold.patientId(), hold.expiresAt(), hold.depositAmount(), hold.currency(),
                hold.status(), hold.version(), hold.createdAt(), hold.updatedAt(),
                new BookingHoldAssignment(selected.practitionerName(), selected.roomName(), selected.slot().startAt(),
                        selected.slot().endAt(), selected.slot().session()));
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
        return createSlotHoldOnLockedSlot(slot, patientId, excludedAppointmentId, context, auditAction);
    }

    private SlotHoldRow createSlotHoldOnLockedSlot(
            AppointmentSlotRow slot,
            UUID patientId,
            UUID excludedAppointmentId,
            SchedulingAuditContext context,
            String auditAction) {
        Instant now = clock.instant();
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
                ids.next(), slot.id(), patientId, expiresAt, price.min(MAX_DEPOSIT), "VND",
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
    public Page<BookingSessionAvailability> getBookingAvailability(
            UUID patientId,
            UUID departmentId,
            UUID serviceId,
            LocalDate localDate,
            String session,
            String cursor,
            int limit) {
        if (session != null && !isSession(session)) throw new IllegalArgumentException("Booking session is invalid");
        int offset = offset(cursor);
        List<BookingSessionAvailability> values = store.searchBookingSessionAvailability(
                        patientId, departmentId, serviceId, localDate, session, clock.instant(), limit + 1, offset)
                .stream()
                .map(projection -> projection.toAvailability())
                .toList();
        return page(values, limit, offset);
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
                || value.serviceId() == null || !isSession(value.session())
                || value.startAt() == null || value.endAt() == null || !value.endAt().isAfter(value.startAt())
                || value.capacity() < 1) {
            throw new IllegalArgumentException("Appointment slot is invalid");
        }
    }

    private static void validateWorkScheduleRequest(CreateWorkScheduleRequest value) {
        if (value == null || value.practitionerRoleId() == null || value.departmentId() == null || value.roomId() == null
                || value.serviceId() == null || value.localDate() == null || !isSession(value.session())
                || value.capacity() < 1) {
            throw new IllegalArgumentException("Work schedule is invalid");
        }
    }

    private static boolean isSession(String value) {
        return "MORNING".equals(value) || "AFTERNOON".equals(value);
    }

    private static SessionWindow sessionWindow(LocalDate localDate, String session) {
        LocalTime start = "MORNING".equals(session) ? LocalTime.of(8, 0) : LocalTime.of(13, 30);
        LocalTime end = "MORNING".equals(session) ? LocalTime.of(12, 0) : LocalTime.of(17, 30);
        return new SessionWindow(localDate.atTime(start).atZone(HO_CHI_MINH).toInstant(),
                localDate.atTime(end).atZone(HO_CHI_MINH).toInstant());
    }

    private record SessionWindow(Instant startAt, Instant endAt) {}

    private record CandidateUsage(WorkScheduleCandidate candidate, int usedCapacity) {}

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
