package vn.medicore.service;

import java.util.UUID;
import vn.medicore.dto.PatientModels.Page;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.BookingCatalog;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
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

    void cancelAppointmentSlot(UUID slotId, long expectedVersion, SchedulingAuditContext context);

    SlotHoldRow createSlotHold(CreateSlotHoldRequest request, SchedulingAuditContext context);

    SlotHoldRow getSlotHoldForAccess(UUID holdId);

    SlotHoldRow getSlotHold(UUID holdId, SchedulingAuditContext context);

    void cancelSlotHold(UUID holdId, long expectedVersion, SchedulingAuditContext context);

    Page<vn.medicore.dto.SchedulingModels.AppointmentRow> searchAppointments(java.util.List<UUID> patientIds, String cursor, int limit);

    vn.medicore.dto.SchedulingModels.AppointmentRow getAppointment(UUID appointmentId);
}
