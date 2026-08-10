package vn.medicore.service;

import java.util.List;
import java.util.UUID;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.dto.SchedulingModels.UpdateAppointmentSlotRequest;

public interface SchedulingService {

    AppointmentSlotRow createAppointmentSlot(CreateAppointmentSlotRequest request, AuthenticatedAccount actor, String requestId, String correlationId);

    AppointmentSlotRow updateAppointmentSlot(UUID slotId, UpdateAppointmentSlotRequest request, long expectedVersion, AuthenticatedAccount actor, String requestId, String correlationId);

    AppointmentSlotRow getAppointmentSlot(UUID slotId);

    List<AppointmentSlotRow> searchAppointmentSlots(int limit, int offset);

    void cancelAppointmentSlot(UUID slotId, long expectedVersion, AuthenticatedAccount actor, String requestId, String correlationId);

    SlotHoldRow createSlotHold(CreateSlotHoldRequest request, AuthenticatedAccount actor, String idempotencyScope, String idempotencyKey, String requestHash, String requestId, String correlationId);

    SlotHoldRow getSlotHold(UUID holdId);

    void cancelSlotHold(UUID holdId, long expectedVersion, AuthenticatedAccount actor, String requestId, String correlationId);
}
