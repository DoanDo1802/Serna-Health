-- V17: Ensure default PATIENT_ADMINISTRATOR role is assigned to all active user accounts without role assignments

insert into account_role_assignment(id, account_id, role_id, department_id, effective_from, effective_to, status, assigned_by_account_id, reason, version, created_at, updated_at)
select
    gen_random_uuid(),
    u.id,
    '01980000-0000-7000-8000-000000000005'::uuid,
    null,
    now(),
    null,
    'ACTIVE',
    u.id,
    'Default patient role assignment',
    0,
    now(),
    now()
from user_account u
where not exists (
    select 1 from account_role_assignment a where a.account_id = u.id and a.status = 'ACTIVE'
);
