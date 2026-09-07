package vn.medicore.repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.BookingCatalog;
import vn.medicore.dto.SchedulingModels.SlotHoldJdbcRow;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;

public interface SchedulingRepository {

    void insertAppointmentSlot(AppointmentSlotRow row);

    void updateAppointmentSlot(AppointmentSlotRow row, long expectedVersion);

    Optional<AppointmentSlotRow> appointmentSlotById(UUID id);

    Optional<AppointmentSlotRow> appointmentSlotByIdForUpdate(UUID id);

    List<AppointmentSlotRow> searchAppointmentSlots(int limit, int offset);

    BookingCatalog bookingCatalog(Instant now);

    void lockPractitionerDay(UUID practitionerRoleId, String dateIso);

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
