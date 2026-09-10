-- Booking availability reads future active slots in chronological order.

create index if not exists ix_appointment_slot_active_start_id
    on appointment_slot (start_at, id)
    where status = 'ACTIVE';

create index if not exists ix_slot_hold_patient_active_expiry_slot
    on slot_hold (patient_id, expires_at, slot_id)
    where status = 'ACTIVE';
