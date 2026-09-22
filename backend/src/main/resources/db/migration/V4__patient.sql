-- R1-04 Patient Management

create table patient (
    id uuid primary key,
    full_name varchar(200) not null,
    date_of_birth date not null,
    phone varchar(32),
    email varchar(320),
    declared_gender varchar(64),
    address varchar(1000),
    emergency_contact jsonb,
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint ck_patient_full_name check (btrim(full_name) <> ''),
    constraint ck_patient_dob check (date_of_birth <= current_date),
    constraint ck_patient_gender check (declared_gender is null or declared_gender in ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN'))
);

create index ix_patient_dob on patient (date_of_birth);
create index ix_patient_phone on patient (phone) where phone is not null;

create table patient_identifier (
    id uuid primary key,
    patient_id uuid not null,
    identifier_type varchar(64) not null,
    issuer varchar(128) not null,
    jurisdiction varchar(64) not null,
    protected_value varchar(512) not null,
    comparison_token varchar(128) not null,
    display_suffix varchar(16) not null,
    status varchar(64) not null,
    verification_source varchar(64) not null,
    collected_by_account_id uuid,
    collected_at timestamptz not null,
    verified_at timestamptz,
    effective_from timestamptz not null,
    revoked_at timestamptz,
    evidence_reference varchar(256),
    version bigint not null default 0,
    constraint fk_patient_identifier_patient foreign key (patient_id) references patient (id) on delete restrict,
    constraint ck_patient_identifier_status check (status in ('SELF_DECLARED', 'STAFF_RECORDED', 'MANUALLY_VERIFIED', 'ENTERED_IN_ERROR', 'REVOKED')),
    constraint ck_patient_identifier_verified check (
        (status = 'MANUALLY_VERIFIED' and verified_at is not null) or
        (status <> 'MANUALLY_VERIFIED' and verified_at is null)
    ),
    constraint ck_patient_identifier_revoked check (
        (status = 'REVOKED' and revoked_at is not null) or
        (status <> 'REVOKED' and revoked_at is null)
    )
);

create unique index uk_patient_identifier_active on patient_identifier (identifier_type, issuer, comparison_token) where status not in ('ENTERED_IN_ERROR', 'REVOKED');
create index ix_patient_identifier_patient_status on patient_identifier (patient_id, status);
create index ix_patient_identifier_token_status on patient_identifier (comparison_token, status);

create table patient_account_link (
    id uuid primary key,
    account_id uuid not null,
    patient_id uuid not null,
    relationship varchar(64) not null,
    verification_tier varchar(64) not null,
    permission_scope jsonb not null,
    valid_from timestamptz not null,
    valid_to timestamptz,
    status varchar(64) not null,
    revoked_at timestamptz,
    revoke_reason varchar(500),
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint fk_patient_account_link_patient foreign key (patient_id) references patient (id) on delete restrict,
    constraint ck_patient_account_link_status check (status in ('ACTIVE', 'REVOKED', 'EXPIRED')),
    constraint ck_patient_account_link_tier check (verification_tier in ('PENDING', 'IDENTITY_VERIFIED', 'REPRESENTATION_VERIFIED')),
    constraint ck_patient_account_link_time check (valid_to is null or valid_to > valid_from)
);

create index ix_patient_account_link_account on patient_account_link (account_id, status, valid_from, valid_to);
create index ix_patient_account_link_patient on patient_account_link (patient_id, status, valid_from, valid_to);
alter table patient_account_link add constraint ex_patient_account_link_active_overlap
    exclude using gist (
        account_id with =,
        patient_id with =,
        tstzrange(valid_from, coalesce(valid_to, 'infinity'::timestamptz), '[)') with &&
    ) where (status = 'ACTIVE');

create table patient_duplicate_candidate (
    id uuid primary key,
    source_patient_id uuid not null,
    candidate_patient_id uuid not null,
    ordered_patient_low_id uuid not null,
    ordered_patient_high_id uuid not null,
    match_reasons jsonb not null,
    score numeric(5,4) not null,
    status varchar(64) not null,
    reviewer_account_id uuid,
    reviewed_at timestamptz,
    review_reason varchar(500),
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint fk_duplicate_candidate_source foreign key (source_patient_id) references patient (id) on delete restrict,
    constraint fk_duplicate_candidate_target foreign key (candidate_patient_id) references patient (id) on delete restrict,
    constraint ck_duplicate_candidate_diff check (source_patient_id <> candidate_patient_id),
    constraint ck_duplicate_candidate_ordered check (ordered_patient_low_id < ordered_patient_high_id),
    constraint ck_duplicate_candidate_score check (score between 0.0 and 1.0),
    constraint ck_duplicate_candidate_status check (status in ('PENDING', 'CONFIRMED', 'REJECTED', 'ENTERED_IN_ERROR')),
    constraint ck_duplicate_candidate_review check (
        (status in ('CONFIRMED', 'REJECTED') and reviewer_account_id is not null and reviewed_at is not null and review_reason is not null) or
        (status not in ('CONFIRMED', 'REJECTED') and reviewer_account_id is null and reviewed_at is null and review_reason is null)
    )
);

create unique index uk_duplicate_candidate_pending on patient_duplicate_candidate (ordered_patient_low_id, ordered_patient_high_id) where status = 'PENDING';
create index ix_duplicate_candidate_status_time on patient_duplicate_candidate (status, created_at);

-- Seed patient permissions
insert into permission (id, action, description, created_at) values
    ('01980000-0000-7001-8000-00000000000c', 'patient.read',            'Read patient basic profile',       timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-00000000000d', 'patient.manage',          'Create and update patients',       timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-00000000000e', 'patient.identity.verify', 'Verify patient identity documents',timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-00000000000f', 'patient.duplicate.review','Review and resolve duplicates',    timestamp with time zone '2026-08-04 00:00:00+00');

-- Bootstrap PATIENT_ADMINISTRATOR role
insert into role (id, code, name, created_at) values
    ('01980000-0000-7000-8000-000000000005', 'PATIENT_ADMINISTRATOR', 'Patient administrator', timestamp with time zone '2026-08-04 00:00:00+00');

insert into role_permission (role_id, permission_id, granted_at, granted_by_account_id) values
    ('01980000-0000-7000-8000-000000000005', '01980000-0000-7001-8000-00000000000c', timestamp with time zone '2026-08-04 00:00:00+00', null),
    ('01980000-0000-7000-8000-000000000005', '01980000-0000-7001-8000-00000000000d', timestamp with time zone '2026-08-04 00:00:00+00', null),
    ('01980000-0000-7000-8000-000000000005', '01980000-0000-7001-8000-00000000000e', timestamp with time zone '2026-08-04 00:00:00+00', null),
    ('01980000-0000-7000-8000-000000000005', '01980000-0000-7001-8000-00000000000f', timestamp with time zone '2026-08-04 00:00:00+00', null);
