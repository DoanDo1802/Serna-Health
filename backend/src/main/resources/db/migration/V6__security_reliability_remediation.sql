-- R1-01/R1-02 remediation. Earlier migrations remain immutable.

alter table idempotency_record
    add column fingerprint_version varchar(16) not null default 'v1',
    add column response_body bytea,
    add column response_content_type varchar(128),
    add column response_etag varchar(128),
    add column response_location varchar(512),
    add column response_headers jsonb,
    add column lease_expires_at timestamptz;

alter table idempotency_record
    add constraint ck_idempotency_response_body check (
        (status = 'IN_PROGRESS' and response_body is null)
        or status in ('SUCCEEDED', 'FAILED')
    );

alter table break_glass_grant
    add column grant_mechanism varchar(32) not null default 'POLICY',
    add column policy_reference varchar(128) not null default 'r1-policy-v1';

alter table break_glass_grant drop constraint ck_break_glass_active_state;
alter table break_glass_grant add constraint ck_break_glass_active_state check (
    status = 'REQUESTED'
    or (
        status in ('ACTIVE', 'EXPIRED', 'REVOKED', 'REVIEWED')
        and granted_at is not null and effective_from is not null and expires_at is not null and review_due_at is not null
        and ((grant_mechanism = 'ACCOUNT' and grantor_account_id is not null) or (grant_mechanism = 'POLICY' and policy_reference is not null))
    )
);
alter table break_glass_grant add constraint ck_break_glass_grant_mechanism
    check (grant_mechanism in ('POLICY', 'ACCOUNT'));
alter table break_glass_grant
    add constraint fk_break_glass_patient foreign key (patient_id) references patient(id) on delete restrict;

-- Canonical OpenAPI permission vocabulary. Legacy actions stay only for compatibility until callers migrate.
insert into permission(id, action, description, created_at) values
    ('01980000-0000-7001-8000-000000000101', 'account.read', 'Read accounts', now()),
    ('01980000-0000-7001-8000-000000000102', 'account.status.change', 'Change account status', now()),
    ('01980000-0000-7001-8000-000000000103', 'role.read', 'Read roles', now()),
    ('01980000-0000-7001-8000-000000000104', 'role.create', 'Create roles', now()),
    ('01980000-0000-7001-8000-000000000105', 'permission.read', 'Read permissions', now()),
    ('01980000-0000-7001-8000-000000000106', 'role.permission.manage', 'Replace role permissions', now()),
    ('01980000-0000-7001-8000-000000000107', 'account.role.read', 'Read account role assignments', now()),
    ('01980000-0000-7001-8000-000000000108', 'department.read', 'Read departments', now()),
    ('01980000-0000-7001-8000-000000000109', 'department.create', 'Create departments', now()),
    ('01980000-0000-7001-8000-00000000010a', 'department.update', 'Update departments', now()),
    ('01980000-0000-7001-8000-00000000010b', 'room.read', 'Read rooms', now()),
    ('01980000-0000-7001-8000-00000000010c', 'room.create', 'Create rooms', now()),
    ('01980000-0000-7001-8000-00000000010d', 'room.update', 'Update rooms', now()),
    ('01980000-0000-7001-8000-00000000010e', 'service.read', 'Read services', now()),
    ('01980000-0000-7001-8000-00000000010f', 'service.create', 'Create services', now()),
    ('01980000-0000-7001-8000-000000000110', 'service.update', 'Update services', now()),
    ('01980000-0000-7001-8000-000000000111', 'service_price.read', 'Read service prices', now()),
    ('01980000-0000-7001-8000-000000000112', 'service_price.create', 'Create service prices', now()),
    ('01980000-0000-7001-8000-000000000113', 'service_price.update', 'Update service prices', now()),
    ('01980000-0000-7001-8000-000000000114', 'practitioner.read', 'Read practitioners', now()),
    ('01980000-0000-7001-8000-000000000115', 'practitioner.create', 'Create practitioners', now()),
    ('01980000-0000-7001-8000-000000000116', 'practitioner.update', 'Update practitioners', now()),
    ('01980000-0000-7001-8000-000000000117', 'practitioner_role.read', 'Read practitioner roles', now()),
    ('01980000-0000-7001-8000-000000000118', 'practitioner_role.create', 'Create practitioner roles', now()),
    ('01980000-0000-7001-8000-000000000119', 'practitioner_role.update', 'Update practitioner roles', now()),
    ('01980000-0000-7001-8000-00000000011a', 'patient.create', 'Create patients', now()),
    ('01980000-0000-7001-8000-00000000011b', 'patient.search', 'Search patients', now()),
    ('01980000-0000-7001-8000-00000000011c', 'patient.read', 'Read patients', now()),
    ('01980000-0000-7001-8000-00000000011d', 'patient.update', 'Update patients', now()),
    ('01980000-0000-7001-8000-00000000011e', 'patient_identifier.read', 'Read patient identifiers', now()),
    ('01980000-0000-7001-8000-00000000011f', 'patient_identifier.create', 'Create patient identifiers', now()),
    ('01980000-0000-7001-8000-000000000120', 'identity.link.verify', 'Verify patient identity links', now()),
    ('01980000-0000-7001-8000-000000000121', 'patient_account_link.read', 'Read patient links', now()),
    ('01980000-0000-7001-8000-000000000122', 'patient_account_link.create', 'Create patient links', now()),
    ('01980000-0000-7001-8000-000000000123', 'patient_duplicate.review', 'Review patient duplicates', now()),
    ('01980000-0000-7001-8000-000000000124', 'audit.break_glass.review', 'Review break-glass grants', now())
on conflict (action) do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000001', id, now(), null from permission
where action in ('account.read', 'account.status.change', 'role.read', 'role.create', 'permission.read', 'role.permission.manage', 'account.role.read', 'account.manage_role')
on conflict do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000004', id, now(), null from permission
where action in ('department.read','department.create','department.update','room.read','room.create','room.update','service.read','service.create','service.update','service_price.read','service_price.create','service_price.update','practitioner.read','practitioner.create','practitioner.update','practitioner_role.read','practitioner_role.create','practitioner_role.update')
on conflict do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000005', id, now(), null from permission
where action in ('patient.create','patient.search','patient.read','patient.update','patient_identifier.read','patient_identifier.create','identity.link.verify','patient_account_link.read','patient_account_link.create','patient_duplicate.review')
on conflict do nothing;
