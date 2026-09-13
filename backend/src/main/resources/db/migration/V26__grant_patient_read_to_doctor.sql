-- Grant patient read and search permissions to DOCTOR role
insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000003', id, now(), null
from permission
where action in (
    'patient.read',
    'patient.search'
)
on conflict do nothing;
