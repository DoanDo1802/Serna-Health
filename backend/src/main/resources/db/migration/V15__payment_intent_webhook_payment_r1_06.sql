-- R1-06 Provider-neutral mock payment intent, webhook inbox, immutable payment capture, and appointment confirmation.

-- 1. Tighten staging appointment table before exactly-one confirmation
alter table appointment
    alter column slot_hold_id set not null,
    add constraint uq_appointment_slot_hold unique (slot_hold_id);

-- 2. payment_intent table
create table payment_intent (
    id uuid primary key,
    slot_hold_id uuid not null unique references slot_hold(id) on delete restrict,
    provider varchar(64) not null,
    provider_reference varchar(128),
    amount numeric(19,2) not null check (amount >= 0),
    currency char(3) not null check (currency = 'VND'),
    status varchar(64) not null check (status in ('REQUIRES_PAYMENT_METHOD', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'RECONCILIATION_REQUIRED')),
    reconciliation_reason varchar(256),
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint ck_payment_intent_reconciliation check (
        (status = 'RECONCILIATION_REQUIRED' and reconciliation_reason is not null)
        or (status <> 'RECONCILIATION_REQUIRED' and reconciliation_reason is null)
    )
);

create unique index uq_payment_intent_provider_reference
    on payment_intent (provider, provider_reference)
    where provider_reference is not null;

create index ix_payment_intent_status_updated
    on payment_intent (status, updated_at);

create index ix_payment_intent_slot_hold
    on payment_intent (slot_hold_id);

-- 3. webhook_inbox table
create table webhook_inbox (
    id uuid primary key,
    provider varchar(64) not null,
    event_id varchar(128) not null,
    event_type varchar(128) not null,
    provider_transaction_id varchar(128),
    signature_status varchar(64) not null check (signature_status in ('VALID', 'INVALID', 'NOT_VERIFIED')),
    payload_hash varchar(128) not null,
    payload jsonb not null,
    provider_occurred_at timestamptz,
    received_at timestamptz not null,
    provider_time_trust varchar(64) not null check (provider_time_trust in ('TRUSTED', 'UNTRUSTED', 'MISSING')),
    amount numeric(19,2) check (amount is null or amount >= 0),
    currency char(3) check ((amount is null and currency is null) or (amount is not null and currency = 'VND')),
    status varchar(64) not null check (status in ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER')),
    processed_at timestamptz,
    error_code varchar(128),
    attempts integer not null default 0 check (attempts >= 0),
    next_attempt_at timestamptz,
    correlation_id varchar(128) not null,
    version bigint not null default 0,
    constraint uq_webhook_inbox_provider_event unique (provider, event_id),
    constraint ck_webhook_inbox_processed_state check (
        (status in ('PROCESSED', 'FAILED', 'DEAD_LETTER') and processed_at is not null)
        or (status not in ('PROCESSED', 'FAILED', 'DEAD_LETTER') and processed_at is null)
    )
);

create index ix_webhook_inbox_status_next
    on webhook_inbox (status, next_attempt_at);

create index ix_webhook_inbox_provider_tx
    on webhook_inbox (provider, provider_transaction_id)
    where provider_transaction_id is not null;

create index ix_webhook_inbox_received
    on webhook_inbox (received_at);

create index ix_webhook_inbox_correlation
    on webhook_inbox (correlation_id);

-- 4. payment table (immutable capture)
create table payment (
    id uuid primary key,
    payment_intent_id uuid references payment_intent(id) on delete restrict,
    provider varchar(64) not null,
    provider_transaction_id varchar(128) not null,
    amount numeric(19,2) not null check (amount > 0),
    currency char(3) not null check (currency = 'VND'),
    status varchar(64) not null check (status in ('CAPTURED', 'FAILED')),
    provider_occurred_at timestamptz,
    provider_time_trust varchar(64) not null check (provider_time_trust in ('TRUSTED', 'UNTRUSTED', 'MISSING', 'SERVER_OCCURRED')),
    webhook_inbox_id uuid references webhook_inbox(id) on delete restrict,
    captured_at timestamptz,
    created_at timestamptz not null,
    constraint uq_payment_provider_transaction unique (provider, provider_transaction_id),
    constraint ck_payment_captured_state check (
        (status = 'CAPTURED' and captured_at is not null)
        or (status <> 'CAPTURED' and captured_at is null)
    )
);

create index ix_payment_intent on payment (payment_intent_id) where payment_intent_id is not null;
create index ix_payment_captured_status on payment (captured_at, status);

create function reject_payment_mutation() returns trigger
language plpgsql
as $$
begin
    raise exception 'payment is append-only' using errcode = '55000';
end;
$$;

create trigger trg_payment_append_only
before update or delete on payment
for each row execute function reject_payment_mutation();

create trigger trg_payment_reject_truncate
before truncate on payment
for each statement execute function reject_payment_mutation();

-- 5. Permissions and role mappings
insert into permission(id, action, description, created_at) values
    ('01980000-0000-7001-8000-00000000012c', 'payment_intent.create', 'Create payment intents', now()),
    ('01980000-0000-7001-8000-00000000012d', 'payment_intent.read', 'Read payment intents', now()),
    ('01980000-0000-7001-8000-00000000012e', 'payment.mock.simulate', 'Simulate mock payment webhook outcomes', now())
on conflict (action) do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000005', id, now(), null from permission
where action in ('payment_intent.create', 'payment_intent.read', 'payment.mock.simulate')
on conflict do nothing;

-- 6. Extend patient_account_link permission scope check constraint to allow intent create/read delegation
alter table patient_account_link drop constraint ck_patient_account_link_scope;
alter table patient_account_link
    add constraint ck_patient_account_link_scope
    check (
        jsonb_typeof(permission_scope) = 'object'
        and permission_scope ? 'version'
        and permission_scope ->> 'version' = '1'
        and permission_scope - 'version' - 'patient.read' - 'slot_hold.create' - 'slot_hold.read' - 'slot_hold.cancel' - 'payment_intent.create' - 'payment_intent.read' = '{}'::jsonb
        and (not (permission_scope ? 'patient.read') or jsonb_typeof(permission_scope -> 'patient.read') = 'boolean')
        and (not (permission_scope ? 'slot_hold.create') or jsonb_typeof(permission_scope -> 'slot_hold.create') = 'boolean')
        and (not (permission_scope ? 'slot_hold.read') or jsonb_typeof(permission_scope -> 'slot_hold.read') = 'boolean')
        and (not (permission_scope ? 'slot_hold.cancel') or jsonb_typeof(permission_scope -> 'slot_hold.cancel') = 'boolean')
        and (not (permission_scope ? 'payment_intent.create') or jsonb_typeof(permission_scope -> 'payment_intent.create') = 'boolean')
        and (not (permission_scope ? 'payment_intent.read') or jsonb_typeof(permission_scope -> 'payment_intent.read') = 'boolean')
    );
