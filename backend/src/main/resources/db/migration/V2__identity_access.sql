create table user_account (
    id uuid primary key,
    normalized_email varchar(320) not null,
    display_email varchar(320) not null,
    email_verified_at timestamptz,
    status varchar(64) not null,
    failed_login_count integer not null default 0,
    locked_until timestamptz,
    last_authenticated_at timestamptz,
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uk_user_account_normalized_email unique (normalized_email),
    constraint ck_user_account_status check (status in ('PENDING_VERIFICATION', 'ACTIVE', 'TEMPORARILY_LOCKED', 'DISABLED', 'PERMANENTLY_LOCKED')),
    constraint ck_user_account_failed_login_count check (failed_login_count between 0 and 5),
    constraint ck_user_account_lock_state check (
        (status = 'TEMPORARILY_LOCKED' and locked_until is not null)
        or (status <> 'TEMPORARILY_LOCKED' and locked_until is null)
    )
);

create index ix_user_account_status_locked_until on user_account (status, locked_until);

create table password_credential (
    id uuid primary key,
    account_id uuid not null,
    encoded_hash varchar(512) not null,
    status varchar(64) not null,
    created_at timestamptz not null,
    revoked_at timestamptz,
    revoke_reason varchar(256),
    constraint fk_password_credential_account foreign key (account_id) references user_account (id) on delete restrict,
    constraint ck_password_credential_status check (status in ('ACTIVE', 'REVOKED', 'SUPERSEDED')),
    constraint ck_password_credential_revoke_state check (
        (status = 'ACTIVE' and revoked_at is null and revoke_reason is null)
        or (status in ('REVOKED', 'SUPERSEDED') and revoked_at is not null and revoke_reason is not null)
    )
);

create unique index uk_password_credential_active_account on password_credential (account_id) where status = 'ACTIVE';
create index ix_password_credential_account_created_at on password_credential (account_id, created_at desc);

create table authentication_challenge (
    id uuid primary key,
    account_id uuid,
    normalized_target varchar(320) not null,
    purpose varchar(64) not null,
    secret_hash varchar(128) not null,
    status varchar(64) not null default 'PENDING',
    attempt_count smallint not null default 0,
    issued_at timestamptz not null,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    revoked_at timestamptz,
    source_ip_hash varchar(128) not null,
    request_id varchar(128) not null,
    constraint fk_auth_challenge_account foreign key (account_id) references user_account (id) on delete restrict,
    constraint ck_auth_challenge_purpose check (purpose in ('LOGIN', 'VERIFY_EMAIL')),
    constraint ck_auth_challenge_status check (status in ('PENDING', 'CONSUMED', 'EXPIRED', 'REVOKED', 'LOCKED')),
    constraint ck_auth_challenge_attempt check (attempt_count between 0 and 5),
    constraint ck_auth_challenge_expiry check (expires_at > issued_at),
    constraint ck_auth_challenge_state check (
        (status = 'PENDING' and consumed_at is null and revoked_at is null)
        or (status = 'CONSUMED' and consumed_at is not null and revoked_at is null)
        or (status in ('EXPIRED', 'LOCKED') and consumed_at is null and revoked_at is null)
        or (status = 'REVOKED' and consumed_at is null and revoked_at is not null)
    )
);

create unique index uk_auth_challenge_pending_target_purpose on authentication_challenge (normalized_target, purpose) where status = 'PENDING';
create index ix_auth_challenge_target_purpose_issued on authentication_challenge (normalized_target, purpose, issued_at desc);
create index ix_auth_challenge_source_ip_issued on authentication_challenge (source_ip_hash, issued_at desc);
create index ix_auth_challenge_expires_pending on authentication_challenge (expires_at) where status = 'PENDING';

create table account_token (
    id uuid primary key,
    account_id uuid not null,
    purpose varchar(64) not null,
    token_hash varchar(128) not null,
    status varchar(64) not null default 'PENDING',
    issued_at timestamptz not null,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    revoked_at timestamptz,
    request_id varchar(128) not null,
    constraint fk_account_token_account foreign key (account_id) references user_account (id) on delete restrict,
    constraint uk_account_token_hash unique (token_hash),
    constraint ck_account_token_purpose check (purpose in ('VERIFY_EMAIL', 'RESET_PASSWORD')),
    constraint ck_account_token_status check (status in ('PENDING', 'CONSUMED', 'EXPIRED', 'REVOKED')),
    constraint ck_account_token_expiry check (expires_at > issued_at),
    constraint ck_account_token_state check (
        (status = 'PENDING' and consumed_at is null and revoked_at is null)
        or (status = 'CONSUMED' and consumed_at is not null and revoked_at is null)
        or (status = 'EXPIRED' and consumed_at is null and revoked_at is null)
        or (status = 'REVOKED' and consumed_at is null and revoked_at is not null)
    )
);

create unique index uk_account_token_pending_account_purpose on account_token (account_id, purpose) where status = 'PENDING';
create index ix_account_token_account_purpose on account_token (account_id, purpose, issued_at desc);
create index ix_account_token_expires_pending on account_token (expires_at) where status = 'PENDING';

create table account_session (
    id uuid primary key,
    account_id uuid not null,
    session_token_hash varchar(128) not null,
    csrf_token_hash varchar(128) not null,
    status varchar(64) not null default 'ACTIVE',
    authenticated_at timestamptz not null,
    last_seen_at timestamptz not null,
    absolute_expires_at timestamptz not null,
    revoked_at timestamptz,
    revoke_reason varchar(256),
    source_ip_hash varchar(128),
    user_agent_hash varchar(128),
    version bigint not null default 0,
    constraint fk_account_session_account foreign key (account_id) references user_account (id) on delete restrict,
    constraint uk_account_session_token_hash unique (session_token_hash),
    constraint ck_account_session_status check (status in ('ACTIVE', 'EXPIRED', 'REVOKED')),
    constraint ck_account_session_expiry check (absolute_expires_at > authenticated_at),
    constraint ck_account_session_revoke_state check (
        (status in ('ACTIVE', 'EXPIRED') and revoked_at is null and revoke_reason is null)
        or (status = 'REVOKED' and revoked_at is not null and revoke_reason is not null)
    )
);

create index ix_account_session_account_status on account_session (account_id, status);
create index ix_account_session_active_expiry on account_session (absolute_expires_at, last_seen_at) where status = 'ACTIVE';

create table role (
    id uuid primary key,
    code varchar(64) not null,
    name varchar(200) not null,
    active boolean not null default true,
    version bigint not null default 0,
    created_at timestamptz not null,
    constraint uk_role_code unique (code),
    constraint ck_role_code check (code ~ '^[A-Z][A-Z0-9_]*$'),
    constraint ck_role_name check (btrim(name) <> '')
);

create index ix_role_active_code on role (active, code);

create table permission (
    id uuid primary key,
    action varchar(128) not null,
    description varchar(500) not null,
    active boolean not null default true,
    created_at timestamptz not null,
    constraint uk_permission_action unique (action),
    constraint ck_permission_action check (action ~ '^[a-z][a-z0-9_.]*$'),
    constraint ck_permission_description check (btrim(description) <> '')
);

create index ix_permission_active_action on permission (active, action);

create table role_permission (
    role_id uuid not null,
    permission_id uuid not null,
    granted_at timestamptz not null,
    granted_by_account_id uuid,
    primary key (role_id, permission_id),
    constraint fk_role_permission_role foreign key (role_id) references role (id) on delete restrict,
    constraint fk_role_permission_permission foreign key (permission_id) references permission (id) on delete restrict,
    constraint fk_role_permission_grantor foreign key (granted_by_account_id) references user_account (id) on delete restrict
);

create index ix_role_permission_permission on role_permission (permission_id, role_id);

create extension if not exists btree_gist;

create table account_role_assignment (
    id uuid primary key,
    account_id uuid not null,
    role_id uuid not null,
    department_id uuid,
    effective_from timestamptz not null,
    effective_to timestamptz,
    status varchar(64) not null,
    assigned_by_account_id uuid not null,
    reason varchar(500) not null,
    revoked_at timestamptz,
    revoked_by_account_id uuid,
    revoke_reason varchar(500),
    version bigint not null default 0,
    constraint fk_account_role_assignment_account foreign key (account_id) references user_account (id) on delete restrict,
    constraint fk_account_role_assignment_role foreign key (role_id) references role (id) on delete restrict,
    constraint fk_account_role_assignment_assigner foreign key (assigned_by_account_id) references user_account (id) on delete restrict,
    constraint fk_account_role_assignment_revoker foreign key (revoked_by_account_id) references user_account (id) on delete restrict,
    constraint ck_account_role_assignment_interval check (effective_to is null or effective_to > effective_from),
    constraint ck_account_role_assignment_status check (status in ('ACTIVE', 'REVOKED', 'EXPIRED')),
    constraint ck_account_role_assignment_reason check (btrim(reason) <> ''),
    constraint ck_account_role_assignment_revoke_state check (
        (status <> 'REVOKED' and revoked_at is null and revoked_by_account_id is null and revoke_reason is null)
        or (status = 'REVOKED' and revoked_at is not null and revoked_by_account_id is not null and revoke_reason is not null)
    )
);

create index ix_account_role_assignment_account_time_status on account_role_assignment (account_id, status, effective_from, effective_to);
create index ix_account_role_assignment_role_time on account_role_assignment (role_id, effective_from, effective_to);
create index ix_account_role_assignment_department_time on account_role_assignment (department_id, effective_from, effective_to) where department_id is not null;
alter table account_role_assignment add constraint ex_account_role_assignment_active_overlap
    exclude using gist (
        account_id with =,
        role_id with =,
        coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
        tstzrange(effective_from, coalesce(effective_to, 'infinity'::timestamptz), '[)') with &&
    ) where (status = 'ACTIVE');

create table break_glass_grant (
    id uuid primary key,
    requester_account_id uuid not null,
    grantor_account_id uuid,
    reviewer_account_id uuid,
    requester_effective_role_snapshot jsonb not null,
    patient_id uuid not null, 
    purpose varchar(500) not null,
    reason varchar(500) not null,
    requested_at timestamptz not null,
    granted_at timestamptz,
    effective_from timestamptz,
    expires_at timestamptz,
    review_due_at timestamptz,
    reviewed_at timestamptz,
    alert_reference varchar(128) not null,
    ticket_reference varchar(128) not null,
    request_id varchar(128) not null,
    session_id varchar(128) not null,
    correlation_id varchar(128) not null,
    status varchar(64) not null,
    review_outcome varchar(64),
    review_reason varchar(500),
    revoked_at timestamptz,
    revoked_by_account_id uuid,
    revoke_reason varchar(500),
    version bigint not null default 0,
    constraint fk_break_glass_requester foreign key (requester_account_id) references user_account (id) on delete restrict,
    constraint fk_break_glass_grantor foreign key (grantor_account_id) references user_account (id) on delete restrict,
    constraint fk_break_glass_reviewer foreign key (reviewer_account_id) references user_account (id) on delete restrict,
    constraint fk_break_glass_revoker foreign key (revoked_by_account_id) references user_account (id) on delete restrict,
    constraint ck_break_glass_status check (status in ('REQUESTED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'REVIEWED')),
    constraint ck_break_glass_review_outcome check (review_outcome is null or review_outcome in ('APPROVED', 'REJECTED', 'ESCALATED')),
    constraint ck_break_glass_text check (btrim(purpose) <> '' and btrim(reason) <> ''),
    constraint ck_break_glass_ttl check (expires_at is null or (effective_from is not null and expires_at > effective_from and expires_at <= effective_from + interval '4 hours')),
    constraint ck_break_glass_active_state check (
        status = 'REQUESTED'
        or (status in ('ACTIVE', 'EXPIRED', 'REVOKED', 'REVIEWED') and grantor_account_id is not null and granted_at is not null and effective_from is not null and expires_at is not null and review_due_at is not null)
    ),
    constraint ck_break_glass_review_state check (
        (status <> 'REVIEWED' and reviewed_at is null and reviewer_account_id is null and review_outcome is null and review_reason is null)
        or (status = 'REVIEWED' and reviewed_at is not null and reviewer_account_id is not null and review_outcome is not null and review_reason is not null)
    ),
    constraint ck_break_glass_revoke_state check (
        (status <> 'REVOKED' and revoked_at is null and revoked_by_account_id is null and revoke_reason is null)
        or (status = 'REVOKED' and revoked_at is not null and revoked_by_account_id is not null and revoke_reason is not null)
    )
);

create index ix_break_glass_patient_status_time on break_glass_grant (patient_id, status, effective_from, expires_at);
create index ix_break_glass_requester_time on break_glass_grant (requester_account_id, requested_at desc);
create index ix_break_glass_review_due_status on break_glass_grant (review_due_at, status) where status in ('ACTIVE', 'EXPIRED', 'REVOKED');

-- Stable UUIDv7-shaped identifiers keep role/permission references deterministic across environments.
insert into role (id, code, name, created_at) values
    ('01980000-0000-7000-8000-000000000001', 'IDENTITY_ADMINISTRATOR', 'Identity administrator', timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7000-8000-000000000002', 'SECURITY_AUDITOR', 'Security auditor', timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7000-8000-000000000003', 'DOCTOR', 'Doctor', timestamp with time zone '2026-08-04 00:00:00+00');

insert into permission (id, action, description, created_at) values
    ('01980000-0000-7001-8000-000000000001', 'account.register', 'Register an account', timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-000000000002', 'account.authenticate', 'Authenticate an account', timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-000000000003', 'account.recover', 'Recover an account', timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-000000000004', 'account.manage_role', 'Manage account roles and permissions', timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-000000000005', 'clinical.break_glass', 'Request patient-scoped emergency access', timestamp with time zone '2026-08-04 00:00:00+00'),
    ('01980000-0000-7001-8000-000000000006', 'audit.read', 'Read redacted audit evidence', timestamp with time zone '2026-08-04 00:00:00+00');

insert into role_permission (role_id, permission_id, granted_at, granted_by_account_id) values
    ('01980000-0000-7000-8000-000000000001', '01980000-0000-7001-8000-000000000004', timestamp with time zone '2026-08-04 00:00:00+00', null),
    ('01980000-0000-7000-8000-000000000002', '01980000-0000-7001-8000-000000000006', timestamp with time zone '2026-08-04 00:00:00+00', null),
    ('01980000-0000-7000-8000-000000000003', '01980000-0000-7001-8000-000000000005', timestamp with time zone '2026-08-04 00:00:00+00', null);
