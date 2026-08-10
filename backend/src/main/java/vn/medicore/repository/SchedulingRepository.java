package vn.medicore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;

public interface SchedulingRepository {

    // --- Appointment Slot ---
    
    void insertAppointmentSlot(AppointmentSlotRow row);
    
    void updateAppointmentSlot(AppointmentSlotRow row, long expectedVersion);
    
    Optional<AppointmentSlotRow> appointmentSlotById(UUID id);

    List<AppointmentSlotRow> searchAppointmentSlots(int limit, int offset);
    
    // Uses PostgreSQL advisory lock to serialize capacity/creation checks for a given practitioner on a given date
    void lockPractitionerDay(UUID practitionerRoleId, String dateIso);

    // Returns the number of active slots for a given practitioner on a specific date in a specific timezone
    int countActiveSlotsByPractitionerAndDate(UUID practitionerRoleId, String dateIso);

    // Returns the number of active slots for a given practitioner on a specific date and session
    int countActiveSlotsByPractitionerAndSession(UUID practitionerRoleId, String dateIso, String session);

    // --- Slot Hold ---
    
    void insertSlotHold(SlotHoldRow row);
    
    void updateSlotHold(SlotHoldRow row, long expectedVersion);
    
    Optional<SlotHoldRow> slotHoldById(UUID id);
    
    Optional<SlotHoldRow> slotHoldByIdempotency(String scope, String key);
    
    // Counts the number of active non-expired slot holds and confirmed appointments for a slot
    int countActiveHoldsAndAppointments(UUID slotId);
    
}
