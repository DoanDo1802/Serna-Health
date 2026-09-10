-- Allow patients, verified representatives, and scheduling staff to cancel appointments.

insert into permission(id, action, description, created_at) values
    ('01980000-0000-7001-8000-000000000130', 'appointment.cancel', 'Cancel appointment', now())
on conflict (action) do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select role_id, id, now(), null
from permission
cross join (values
    ('01980000-0000-7000-8000-000000000004'::uuid),
    ('01980000-0000-7000-8000-000000000005'::uuid)
) as roles(role_id)
where action = 'appointment.cancel'
on conflict do nothing;

alter table patient_account_link drop constraint ck_patient_account_link_scope;
alter table patient_account_link
    add constraint ck_patient_account_link_scope
    check (
        jsonb_typeof(permission_scope) = 'object'
        and permission_scope ? 'version'
        and permission_scope ->> 'version' = '1'
        and permission_scope - 'version' - 'patient.read' - 'slot_hold.create' - 'slot_hold.read' - 'slot_hold.cancel' - 'payment_intent.create' - 'payment_intent.read' - 'appointment.reschedule' - 'appointment.cancel' = '{}'::jsonb
        and (not (permission_scope ? 'patient.read') or jsonb_typeof(permission_scope -> 'patient.read') = 'boolean')
        and (not (permission_scope ? 'slot_hold.create') or jsonb_typeof(permission_scope -> 'slot_hold.create') = 'boolean')
        and (not (permission_scope ? 'slot_hold.read') or jsonb_typeof(permission_scope -> 'slot_hold.read') = 'boolean')
        and (not (permission_scope ? 'slot_hold.cancel') or jsonb_typeof(permission_scope -> 'slot_hold.cancel') = 'boolean')
        and (not (permission_scope ? 'payment_intent.create') or jsonb_typeof(permission_scope -> 'payment_intent.create') = 'boolean')
        and (not (permission_scope ? 'payment_intent.read') or jsonb_typeof(permission_scope -> 'payment_intent.read') = 'boolean')
        and (not (permission_scope ? 'appointment.reschedule') or jsonb_typeof(permission_scope -> 'appointment.reschedule') = 'boolean')
        and (not (permission_scope ? 'appointment.cancel') or jsonb_typeof(permission_scope -> 'appointment.cancel') = 'boolean')
    );
