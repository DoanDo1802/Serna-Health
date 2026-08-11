-- R1-02 security auditor grants. Earlier Flyway migrations remain immutable.

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000002', id, now(), null
from permission
where action in ('audit.read', 'audit.break_glass.review')
on conflict do nothing;
