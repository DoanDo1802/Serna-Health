-- R1-03 Catalog: Department / Room / Service / ServicePrice / Practitioner / PractitionerRole

create table department (
    id uuid primary key,
    code varchar(64) not null,
    name varchar(200) not null,
    active boolean not null default true,
    effective_from timestamptz not null,
    effective_to timestamptz,
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uk_department_code unique (code),
    constraint ck_department_code_nonblank check (btrim(code) <> ''),
    constraint ck_department_name_nonblank check (btrim(name) <> ''),
    constraint ck_department_effective check (effective_to is null or effective_to > effective_from)
);

create index ix_department_active_effective on department (active, effective_from, effective_to);

-- Backfill FK on account_role_assignment (R1-02 created the column as logical UUID reference)
alter table account_role_assignment
    add constraint fk_account_role_assignment_department
        foreign key (department_id) references department (id) on delete restrict;

create table room (
    id uuid primary key,
    department_id uuid not null,
    code varchar(64) not null,
    name varchar(200) not null,
    active boolean not null default true,
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint fk_room_department foreign key (department_id) references department (id) on delete restrict,
    constraint uk_room_department_code unique (department_id, code),
    constraint ck_room_code_nonblank check (btrim(code) <> ''),
    constraint ck_room_name_nonblank check (btrim(name) <> '')
);

create index ix_room_department_active on room (department_id, active);

create table service (
    id uuid primary key,
    code varchar(64) not null,
    name varchar(200) not null,
    service_type varchar(64) not null,
    active boolean not null default true,
    allows_critical boolean not null default false,
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uk_service_code unique (code),
    constraint ck_service_type check (service_type in ('CONSULTATION', 'PROCEDURE', 'DIAGNOSTIC', 'LAB', 'IMAGING', 'THERAPY', 'OTHER')),
    constraint ck_service_code_nonblank check (btrim(code) <> ''),
    constraint ck_service_name_nonblank check (btrim(name) <> ''),
    constraint ck_service_allows_critical check (allows_critical = false)
);

create index ix_service_type_active on service (service_type, active);

create table service_price (
    id uuid primary key,
    service_id uuid not null,
    amount numeric(19,2) not null,
    currency char(3) not null default 'VND',
    effective_from timestamptz not null,
    effective_to timestamptz,
    created_at timestamptz not null,
    constraint fk_service_price_service foreign key (service_id) references service (id) on delete restrict,
    constraint ck_service_price_amount check (amount >= 0),
    constraint ck_service_price_currency check (currency = 'VND'),
    constraint ck_service_price_effective check (effective_to is null or effective_to > effective_from)
);

create index ix_service_price_service_effective on service_price (service_id, effective_from, effective_to);

create table practitioner (
    id uuid primary key,
    user_account_id uuid,
    staff_code varchar(64) not null,
    full_name varchar(200) not null,
    active boolean not null default true,
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint fk_practitioner_account foreign key (user_account_id) references user_account (id) on delete restrict,
    constraint uk_practitioner_staff_code unique (staff_code),
    constraint ck_practitioner_staff_code_nonblank check (btrim(staff_code) <> ''),
    constraint ck_practitioner_name_nonblank check (btrim(full_name) <> '')
);

create unique index uk_practitioner_user_account on practitioner (user_account_id) where user_account_id is not null;
create index ix_practitioner_active_name on practitioner (active, full_name);

create table practitioner_role (
    id uuid primary key,
    practitioner_id uuid not null,
    department_id uuid not null,
    role_code varchar(64) not null,
    effective_from timestamptz not null,
    effective_to timestamptz,
    status varchar(64) not null default 'ACTIVE',
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint fk_practitioner_role_practitioner foreign key (practitioner_id) references practitioner (id) on delete restrict,
    constraint fk_practitioner_role_department foreign key (department_id) references department (id) on delete restrict,
    constraint ck_practitioner_role_code check (role_code in ('DOCTOR', 'TECHNICIAN', 'LAB_APPROVER', 'RADIOLOGIST', 'CARE_COORDINATOR')),
    constraint ck_practitioner_role_status check (status in ('ACTIVE', 'REVOKED', 'EXPIRED')),
    constraint ck_practitioner_role_effective check (effective_to is null or effective_to > effective_from)
);

create index ix_practitioner_role_practitioner_status_time on practitioner_role (practitioner_id, status, effective_from, effective_to);
create index ix_practitioner_role_department_role_time on practitioner_role (department_id, role_code, effective_from, effective_to);

-- Seed catalog permissions
insert into permission (id, action, description, created_at) values
    ('01980000-0000-7001-8000-000000000007', 'catalog.department.read',   'Read department catalog',          timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-000000000008', 'catalog.department.manage', 'Create and update departments',    timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-000000000009', 'catalog.room.manage',       'Create and update rooms',          timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-00000000000a', 'catalog.service.manage',    'Create and update services/prices',timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-00000000000b', 'catalog.practitioner.manage','Create and update practitioners', timestamp with time zone '2026-08-04 00:00:00+00');

-- Bootstrap CATALOG_ADMINISTRATOR role
insert into role (id, code, name, created_at) values
    ('01980000-0000-7000-8000-000000000004', 'CATALOG_ADMINISTRATOR', 'Catalog administrator', timestamp with time zone '2026-08-04 00:00:00+00');

insert into role_permission (role_id, permission_id, granted_at, granted_by_account_id) values
    ('01980000-0000-7000-8000-000000000004', '01980000-0000-7001-8000-000000000007', timestamp with time zone '2026-08-04 00:00:00+00', null),
    ('01980000-0000-7000-8000-000000000004', '01980000-0000-7001-8000-000000000008', timestamp with time zone '2026-08-04 00:00:00+00', null),
    ('01980000-0000-7000-8000-000000000004', '01980000-0000-7001-8000-000000000009', timestamp with time zone '2026-08-04 00:00:00+00', null),
    ('01980000-0000-7000-8000-000000000004', '01980000-0000-7001-8000-00000000000a', timestamp with time zone '2026-08-04 00:00:00+00', null),
    ('01980000-0000-7000-8000-000000000004', '01980000-0000-7001-8000-00000000000b', timestamp with time zone '2026-08-04 00:00:00+00', null);
