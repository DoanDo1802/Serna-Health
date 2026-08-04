create table audit_event (
    id uuid primary key,
    actor_type varchar(64) not null,
    actor_account_id uuid,
    effective_role_snapshot jsonb,
    patient_id uuid,
    purpose varchar(256) not null,
    authorization_basis varchar(256) not null,
    resource_type varchar(128) not null,
    resource_id uuid,
    resource_version bigint,
    resource_digest varchar(128),
    action varchar(128) not null,
    outcome varchar(64) not null,
    reason varchar(500),
    source_system varchar(128) not null,
    source_event varchar(128) not null,
    session_id varchar(128),
    request_id varchar(128) not null,
    correlation_id varchar(128) not null,
    before_redacted jsonb,
    after_redacted jsonb,
    export_event boolean not null default false,
    download_event boolean not null default false,
    recipient_account_id uuid,
    delivery_channel varchar(64),
    reviewer_account_id uuid,
    approval_reference varchar(128),
    source_ip_hash varchar(128),
    device_hash varchar(128),
    occurred_at timestamptz not null,
    constraint ck_audit_event_actor_type check (actor_type in ('ANONYMOUS', 'ACCOUNT', 'SYSTEM')),
    constraint ck_audit_event_actor_account check (
        (actor_type = 'ACCOUNT' and actor_account_id is not null)
        or (actor_type <> 'ACCOUNT' and actor_account_id is null)
    ),
    constraint ck_audit_event_outcome check (outcome in ('SUCCEEDED', 'DENIED', 'FAILED')),
    constraint ck_audit_event_reason check (outcome = 'SUCCEEDED' or reason is not null),
    constraint ck_audit_event_action check (action ~ '^[a-z][a-z0-9_.]*$')
);

create index ix_audit_event_patient_occurred_at on audit_event (patient_id, occurred_at desc) where patient_id is not null;
create index ix_audit_event_resource_version on audit_event (resource_type, resource_id, resource_version);
create index ix_audit_event_actor_occurred_at on audit_event (actor_account_id, occurred_at desc) where actor_account_id is not null;
create index ix_audit_event_correlation on audit_event (correlation_id);
create index ix_audit_event_action_outcome_occurred_at on audit_event (action, outcome, occurred_at desc);
create index ix_audit_event_export_occurred_at on audit_event (occurred_at desc) where export_event or download_event;

create function reject_audit_event_mutation() returns trigger
language plpgsql
as $$
begin
    raise exception 'audit_event is append-only' using errcode = '55000';
end;
$$;

create trigger trg_audit_event_append_only
before update or delete on audit_event
for each row execute function reject_audit_event_mutation();

create trigger trg_audit_event_reject_truncate
before truncate on audit_event
for each statement execute function reject_audit_event_mutation();

create table idempotency_record (
    id uuid primary key,
    principal_scope varchar(128) not null,
    operation varchar(128) not null,
    idempotency_key varchar(128) not null,
    request_hash varchar(128) not null,
    status varchar(64) not null,
    response_type varchar(128),
    response_id uuid,
    response_status integer,
    error_code varchar(128),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    expires_at timestamptz not null,
    version bigint not null default 0,
    constraint uk_idempotency_scope_operation_key unique (principal_scope, operation, idempotency_key),
    constraint ck_idempotency_status check (status in ('IN_PROGRESS', 'SUCCEEDED', 'FAILED')),
    constraint ck_idempotency_key_length check (char_length(idempotency_key) between 8 and 128),
    constraint ck_idempotency_expiry check (expires_at > created_at),
    constraint ck_idempotency_response check (
        (status = 'IN_PROGRESS' and response_status is null and error_code is null)
        or (status = 'SUCCEEDED' and response_status between 200 and 399 and error_code is null)
        or (status = 'FAILED' and response_status between 400 and 599 and error_code is not null)
    )
);

create index ix_idempotency_expiry_status on idempotency_record (expires_at, status);
create index ix_idempotency_response_identity on idempotency_record (response_type, response_id) where response_id is not null;

create table outbox_event (
    id uuid primary key,
    aggregate_type varchar(128) not null,
    aggregate_id uuid not null,
    event_type varchar(128) not null,
    payload_schema_version varchar(32) not null,
    payload jsonb not null,
    occurred_at timestamptz not null,
    published_at timestamptz,
    attempts integer not null default 0,
    status varchar(64) not null default 'PENDING',
    next_attempt_at timestamptz,
    error_code varchar(128),
    correlation_id varchar(128) not null,
    version bigint not null default 0,
    constraint ck_outbox_status check (status in ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'DEAD_LETTER')),
    constraint ck_outbox_attempts check (attempts >= 0),
    constraint ck_outbox_published_state check (
        (status = 'PUBLISHED' and published_at is not null)
        or (status <> 'PUBLISHED' and published_at is null)
    )
);

create index ix_outbox_pending on outbox_event (status, next_attempt_at, occurred_at) where status in ('PENDING', 'FAILED');
create index ix_outbox_aggregate_history on outbox_event (aggregate_type, aggregate_id, occurred_at);
create index ix_outbox_correlation on outbox_event (correlation_id);
