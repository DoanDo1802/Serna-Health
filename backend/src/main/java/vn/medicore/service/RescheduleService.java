package vn.medicore.service;

import java.util.UUID;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.AppointmentRow;
import vn.medicore.dto.SchedulingModels.RescheduleAppointmentRequest;
import vn.medicore.dto.SchedulingModels.RescheduleAppointmentResponse;

public interface RescheduleService {

    AppointmentRow getAppointmentForAccess(UUID appointmentId);

    RescheduleAppointmentResponse rescheduleAppointment(
            UUID oldAppointmentId,
            RescheduleAppointmentRequest request,
            long ifMatchVersion,
            SchedulingAuditContext context,
            boolean isStaffOverride);
}
