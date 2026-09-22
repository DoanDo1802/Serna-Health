-- Grant appointment.cancel to DOCTOR, RECEPTIONIST, and IDENTITY_ADMINISTRATOR
insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select role_id, id, now(), null
from permission
cross join (values
    ('01980000-0000-7000-8000-000000000001'::uuid), -- IDENTITY_ADMINISTRATOR
    ('01980000-0000-7000-8000-000000000003'::uuid), -- DOCTOR
    ('01980000-0000-7000-8000-000000000006'::uuid)  -- RECEPTIONIST
) as roles(role_id)
where action = 'appointment.cancel'
on conflict do nothing;
