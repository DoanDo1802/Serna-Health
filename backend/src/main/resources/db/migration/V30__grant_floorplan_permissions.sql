-- V30: Grant floor plan permissions to catalog administrator, receptionist, and doctor roles.

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select roles.role_id, p.id, now(), null
from permission p
cross join (values
    ('01980000-0000-7000-8000-000000000001'::uuid), -- IDENTITY_ADMINISTRATOR
    ('01980000-0000-7000-8000-000000000004'::uuid)  -- CATALOG_ADMINISTRATOR
) as roles(role_id)
where p.action = 'floorplan.manage'
on conflict do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select roles.role_id, p.id, now(), null
from permission p
cross join (values
    ('01980000-0000-7000-8000-000000000001'::uuid), -- IDENTITY_ADMINISTRATOR
    ('01980000-0000-7000-8000-000000000004'::uuid), -- CATALOG_ADMINISTRATOR
    ('01980000-0000-7000-8000-000000000006'::uuid), -- RECEPTIONIST
    ('01980000-0000-7000-8000-000000000003'::uuid)  -- DOCTOR
) as roles(role_id)
where p.action = 'floorplan.read'
on conflict do nothing;
