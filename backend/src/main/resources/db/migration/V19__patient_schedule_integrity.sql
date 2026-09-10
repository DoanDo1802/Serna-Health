-- Same-patient schedule conflicts are enforced by transaction-scoped advisory locks plus
-- service checks. These indexes support candidate interval lookups without exposing other
-- patients' reservation state.

create index if not exists idx_slot_hold_patient_active_slot
    on slot_hold (patient_id, slot_id, expires_at)
    where status = 'ACTIVE';

create index if not exists idx_appointment_patient_reserving_slot
    on appointment (patient_id, slot_id)
    where status in ('CONFIRMED', 'FULFILLED');
