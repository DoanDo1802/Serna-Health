package vn.medicore.service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import vn.medicore.dto.PatientModels.Page;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.AppointmentRow;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.BookingAvailabilitySlot;
import vn.medicore.dto.SchedulingModels.BookingCatalog;
import vn.medicore.dto.SchedulingModels.BookingSessionAvailability;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.CreateBookingSessionHoldRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldResponse;
import vn.medicore.dto.SchedulingModels.CreateWorkScheduleRequest;
import vn.medicore.dto.SchedulingModels.UpdateWorkScheduleRequest;
import vn.medicore.dto.SchedulingModels.WorkScheduleCatalog;
import vn.medicore.dto.SchedulingModels.WorkScheduleRow;
import vn.medicore.dto.SchedulingModels.CreateRescheduleSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.PatientAppointment;
import vn.medicore.dto.SchedulingModels.RescheduleCatalog;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.dto.SchedulingModels.UpdateAppointmentSlotRequest;

public interface SchedulingService {

    AppointmentSlotRow createAppointmentSlot(CreateAppointmentSlotRequest request, SchedulingAuditContext context);

    AppointmentSlotRow updateAppointmentSlot(
            UUID slotId,
            UpdateAppointmentSlotRequest request,
            long expectedVersion,
            SchedulingAuditContext context);

    AppointmentSlotRow getAppointmentSlot(UUID slotId);

    Page<AppointmentSlotRow> searchAppointmentSlots(String cursor, int limit);

    BookingCatalog bookingCatalog();

    RescheduleCatalog rescheduleCatalog();

    WorkScheduleCatalog workScheduleCatalog();

    WorkScheduleRow createWorkSchedule(CreateWorkScheduleRequest request, SchedulingAuditContext context);

    WorkScheduleRow updateWorkSchedule(
            UUID scheduleId,
            UpdateWorkScheduleRequest request,
            long expectedVersion,
            SchedulingAuditContext context);

    WorkScheduleRow getWorkSchedule(UUID scheduleId);

    Page<WorkScheduleRow> searchWorkSchedules(LocalDate fromDate, LocalDate toDate, String cursor, int limit);

    void cancelWorkSchedule(UUID scheduleId, long expectedVersion, SchedulingAuditContext context);

    void cancelAppointmentSlot(UUID slotId, long expectedVersion, SchedulingAuditContext context);

    SlotHoldRow createSlotHold(CreateSlotHoldRequest request, SchedulingAuditContext context);

    CreateSlotHoldResponse createBookingSessionHold(CreateBookingSessionHoldRequest request, SchedulingAuditContext context);

    SlotHoldRow createRescheduleSlotHold(CreateRescheduleSlotHoldRequest request, SchedulingAuditContext context);

    SlotHoldRow getSlotHoldForAccess(UUID holdId);

    SlotHoldRow getSlotHold(UUID holdId, SchedulingAuditContext context);

    void cancelSlotHold(UUID holdId, long expectedVersion, SchedulingAuditContext context);

    Page<AppointmentRow> searchAppointments(List<UUID> patientIds, String cursor, int limit);

    AppointmentRow getAppointment(UUID appointmentId);

    Page<PatientAppointment> searchPatientAppointments(List<UUID> patientIds, String cursor, int limit);

    PatientAppointment getPatientAppointment(UUID appointmentId);

    Page<BookingSessionAvailability> getBookingAvailability(
            UUID patientId,
            UUID departmentId,
            UUID serviceId,
            LocalDate localDate,
            String session,
            String cursor,
            int limit);

    Page<BookingAvailabilitySlot> getRescheduleAvailability(UUID appointmentId, String cursor, int limit);

    PatientAppointment cancelAppointment(
            UUID appointmentId,
            long expectedVersion,
            String reason,
            SchedulingAuditContext context,
            boolean isStaff);
}
