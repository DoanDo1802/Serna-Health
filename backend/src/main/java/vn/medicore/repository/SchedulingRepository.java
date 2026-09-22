package vn.medicore.repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.BookingAvailabilityProjection;
import vn.medicore.dto.SchedulingModels.BookingCatalog;
import vn.medicore.dto.SchedulingModels.RescheduleCatalog;
import vn.medicore.dto.SchedulingModels.BookingSessionAvailabilityProjection;
import vn.medicore.dto.SchedulingModels.BookingSessionRow;
import vn.medicore.dto.SchedulingModels.WorkScheduleCandidate;
import vn.medicore.dto.SchedulingModels.WorkScheduleCatalog;
import vn.medicore.dto.SchedulingModels.WorkScheduleRow;
import vn.medicore.dto.SchedulingModels.SlotHoldJdbcRow;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;

public interface SchedulingRepository {

    void insertAppointmentSlot(AppointmentSlotRow row);

    void updateAppointmentSlot(AppointmentSlotRow row, long expectedVersion);

    Optional<AppointmentSlotRow> appointmentSlotById(UUID id);

    Optional<AppointmentSlotRow> appointmentSlotByIdForUpdate(UUID id);

    List<AppointmentSlotRow> searchAppointmentSlots(int limit, int offset);

    List<BookingAvailabilityProjection> searchBookingAvailability(
            UUID patientId,
            Instant now,
            UUID excludedAppointmentId,
            UUID currentSlotId,
            int limit,
            int offset);

    BookingCatalog bookingCatalog(Instant now);

    RescheduleCatalog rescheduleCatalog(Instant now);

    WorkScheduleCatalog workScheduleCatalog(Instant now);

    boolean isWorkScheduleConfigurationAvailable(
            UUID practitionerRoleId,
            UUID departmentId,
            UUID roomId,
            UUID serviceId,
            Instant now);

    Optional<BookingSessionRow> activeBookingSessionByBucketForUpdate(
            UUID departmentId, UUID serviceId, LocalDate localDate, String session);

    void insertBookingSession(BookingSessionRow row);

    Optional<BookingSessionRow> bookingSessionById(UUID id);

    Optional<BookingSessionRow> activeBookingSessionByIdForUpdate(UUID id);

    void insertWorkSchedule(WorkScheduleRow row);

    void linkAppointmentSlotToWorkSchedule(UUID slotId, UUID workScheduleId);

    void updateWorkSchedule(WorkScheduleRow row, long expectedVersion);

    Optional<WorkScheduleRow> workScheduleById(UUID id, Instant now);

    Optional<WorkScheduleRow> workScheduleByIdForUpdate(UUID id, Instant now);

    List<WorkScheduleRow> searchWorkSchedules(LocalDate fromDate, LocalDate toDate, int limit, int offset, Instant now);

    List<BookingSessionAvailabilityProjection> searchBookingSessionAvailability(
            UUID patientId,
            UUID departmentId,
            UUID serviceId,
            LocalDate localDate,
            String session,
            Instant now,
            int limit,
            int offset);

    List<WorkScheduleCandidate> workScheduleCandidatesForBookingSession(UUID bookingSessionId, Instant now);

    void lockPractitionerDay(UUID practitionerRoleId, String dateIso);

    void lockBookingSessionBucket(UUID departmentId, UUID serviceId, LocalDate localDate, String session);

    void lockPatientSchedule(UUID patientId);

    boolean hasPatientScheduleConflict(
            UUID patientId,
            Instant startAt,
            Instant endAt,
            Instant now,
            UUID excludedAppointmentId,
            UUID excludedSlotHoldId);

    boolean hasPatientSlotReservation(UUID patientId, UUID slotId, Instant now, UUID excludedAppointmentId, UUID excludedSlotHoldId);

    int countActiveSlotsByPractitionerAndDate(UUID practitionerRoleId, String dateIso);

    int countActiveSlotsByPractitionerAndSession(UUID practitionerRoleId, String dateIso, String session);

    void insertSlotHold(SlotHoldJdbcRow row);

    void updateSlotHold(SlotHoldJdbcRow row, long expectedVersion);

    Optional<SlotHoldRow> slotHoldById(UUID id);

    Optional<SlotHoldRow> slotHoldByIdForUpdate(UUID id);

    int expireActiveHolds(UUID slotId, Instant now);

    int countActiveHoldsAndAppointments(UUID slotId, Instant now);

    Optional<BigDecimal> effectiveServicePrice(UUID serviceId, Instant at);

    void insertAppointment(vn.medicore.dto.SchedulingModels.AppointmentRow row);

    void updateAppointment(vn.medicore.dto.SchedulingModels.AppointmentRow row, long expectedVersion);

    Optional<vn.medicore.dto.SchedulingModels.AppointmentRow> appointmentById(UUID id);

    Optional<vn.medicore.dto.SchedulingModels.AppointmentRow> appointmentByIdForUpdate(UUID id);

    Optional<vn.medicore.dto.SchedulingModels.AppointmentRow> appointmentBySlotHoldId(UUID slotHoldId);

    List<vn.medicore.dto.SchedulingModels.AppointmentRow> searchAppointments(List<UUID> patientIds, int limit, int offset);

    List<vn.medicore.dto.SchedulingModels.PatientAppointment> searchPatientAppointments(List<UUID> patientIds, Instant now, int limit, int offset);

    Optional<vn.medicore.dto.SchedulingModels.PatientAppointment> patientAppointmentById(UUID id, Instant now);

    void insertDepositAllocation(vn.medicore.dto.PaymentModels.DepositAllocationRow row);

    void updateDepositAllocationStatus(UUID id, String newStatus, String expectedStatus);

    List<vn.medicore.dto.PaymentModels.DepositAllocationRow> depositAllocationsByAppointmentId(UUID appointmentId);

    Optional<vn.medicore.dto.PaymentModels.DepositAllocationRow> activeDepositAllocationByAppointmentId(UUID appointmentId);

    List<vn.medicore.dto.PaymentModels.DepositAllocationRow> activeDepositAllocationsByAppointmentIdForUpdate(UUID appointmentId);

    Optional<vn.medicore.dto.PaymentModels.DepositAllocationRow> depositAllocationById(UUID id);

    void insertDepositTransfer(vn.medicore.dto.PaymentModels.DepositTransferRow row);

    void insertDepositTransferLeg(vn.medicore.dto.PaymentModels.DepositTransferLegRow row);

    Optional<vn.medicore.dto.PaymentModels.DepositTransferRow> depositTransferByOldAppointmentId(UUID oldAppointmentId);
}
