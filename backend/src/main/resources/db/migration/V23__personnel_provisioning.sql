-- Admin personnel provisioning: doctor profile, lifecycle support, and least-privilege staff role.

create table personnel_member (
    account_id uuid primary key,
    staff_code varchar(64) not null,
    full_name varchar(200) not null,
    active boolean not null default true,
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint fk_personnel_member_account foreign key (account_id)
        references user_account(id) on delete restrict,
    constraint uk_personnel_member_staff_code unique (staff_code),
    constraint ck_personnel_member_staff_code_nonblank check (btrim(staff_code) <> ''),
    constraint ck_personnel_member_full_name_nonblank check (btrim(full_name) <> '')
);

create index ix_personnel_member_active_name on personnel_member (active, full_name);

create table practitioner_profile (
    practitioner_id uuid primary key,
    phone varchar(16) not null,
    date_of_birth date not null,
    gender varchar(32) not null,
    address varchar(1000) not null,
    professional_title varchar(200) not null,
    academic_degree varchar(200) not null,
    specialty_designation varchar(200) not null,
    license_number varchar(128) not null,
    licensing_authority varchar(200) not null,
    license_issued_on date not null,
    license_expires_on date,
    years_experience integer not null,
    biography varchar(4000),
    avatar_url varchar(2048),
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint fk_practitioner_profile_practitioner foreign key (practitioner_id)
        references practitioner(id) on delete restrict,
    constraint uk_practitioner_profile_license_number unique (license_number),
    constraint ck_practitioner_profile_phone check (phone ~ '^[+][1-9][0-9]{7,14}$'),
    constraint ck_practitioner_profile_gender check (gender in ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED')),
    constraint ck_practitioner_profile_years_experience check (years_experience between 0 and 80),
    constraint ck_practitioner_profile_license_dates check (
        license_expires_on is null or license_expires_on > license_issued_on
    ),
    constraint ck_practitioner_profile_nonblank check (
        btrim(address) <> '' and btrim(professional_title) <> '' and btrim(academic_degree) <> ''
        and btrim(specialty_designation) <> '' and btrim(license_number) <> ''
        and btrim(licensing_authority) <> ''
    )
);

create index ix_practitioner_profile_license_expiry on practitioner_profile (license_expires_on)
    where license_expires_on is not null;

insert into permission(id, action, description, created_at) values
    ('01980000-0000-7001-8000-000000000131', 'account.provision',
        'Provision and deactivate personnel accounts', now())
on conflict (action) do nothing;

insert into role(id, code, name, active, version, created_at) values
    ('01980000-0000-7000-8000-000000000006', 'RECEPTIONIST', 'Receptionist', true, 0, now())
on conflict (code) do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000001', id, now(), null
from permission
where action = 'account.provision'
on conflict do nothing;
