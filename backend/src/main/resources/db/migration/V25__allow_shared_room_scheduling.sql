-- Allow multiple practitioners to share the same examination room during the same time window.
alter table appointment_slot drop constraint if exists ex_appointment_slot_room_overlap;

-- Grant read permissions to DOCTOR role so doctors can view their own schedules and catalog
insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000003', id, now(), null
from permission
where action in (
    'work_schedule.read',
    'department.read',
    'room.read',
    'service.read',
    'practitioner.read',
    'practitioner_role.read',
    'appointment_slot.read'
)
on conflict do nothing;

