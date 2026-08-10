-- R1-03 timeline integrity. Existing rows must be corrected before migration if overlaps exist.
create extension if not exists btree_gist;

alter table service_price add column version bigint not null default 0;
alter table service_price add column updated_at timestamptz not null default now();
alter table service_price add constraint ex_service_price_effective_range
    exclude using gist (service_id with =, currency with =,
        tstzrange(effective_from, coalesce(effective_to, 'infinity'::timestamptz), '[)') with &&);

alter table practitioner_role add column revoked_at timestamptz;
alter table practitioner_role add column revoked_by_account_id uuid references user_account(id) on delete restrict;
alter table practitioner_role add column revoke_reason varchar(500);
alter table practitioner_role add constraint ex_practitioner_role_active_range
    exclude using gist (practitioner_id with =, department_id with =, role_code with =,
        tstzrange(effective_from, coalesce(effective_to, 'infinity'::timestamptz), '[)') with &&)
    where (status = 'ACTIVE');
