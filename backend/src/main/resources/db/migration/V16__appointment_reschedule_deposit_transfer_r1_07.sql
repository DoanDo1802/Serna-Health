-- R1-07 Reschedule lineage and deposit transfer schema.

-- 1. Extend appointment with reciprocal lineage and unique constraints
alter table appointment
    add column if not exists rescheduled_from_id uuid references appointment(id) on delete restrict,
    add column if not exists rescheduled_to_id uuid references appointment(id) on delete restrict;

alter table appointment drop constraint if exists appointment_status_check;
alter table appointment drop constraint if exists ck_appointment_status;
alter table appointment
    add constraint ck_appointment_status
    check (status in ('CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'FULFILLED', 'NO_SHOW'));

alter table appointment drop constraint if exists ck_appointment_no_self_reschedule;
alter table appointment
    add constraint ck_appointment_no_self_reschedule
    check (
        (rescheduled_from_id is null or rescheduled_from_id <> id)
        and (rescheduled_to_id is null or rescheduled_to_id <> id)
    );

create unique index if not exists uq_appointment_slot_hold on appointment (slot_hold_id) where slot_hold_id is not null;
create unique index if not exists uq_appointment_rescheduled_from on appointment (rescheduled_from_id) where rescheduled_from_id is not null;
create unique index if not exists uq_appointment_rescheduled_to on appointment (rescheduled_to_id) where rescheduled_to_id is not null;

-- 2. Create deposit_allocation table
create table deposit_allocation (
    id uuid primary key,
    payment_id uuid not null references payment(id) on delete restrict,
    appointment_id uuid not null references appointment(id) on delete restrict,
    amount numeric(19,2) not null check (amount > 0),
    currency varchar(3) not null check (currency ~ '^[A-Z]{3}$' and currency = 'VND'),
    allocation_type varchar(64) not null check (allocation_type in ('ORIGINAL', 'TRANSFER_IN')),
    source_allocation_id uuid references deposit_allocation(id) on delete restrict,
    status varchar(64) not null check (status in ('ACTIVE', 'TRANSFERRED', 'REFUND_PENDING', 'REFUNDED', 'ENTERED_IN_ERROR')),
    created_at timestamptz not null,
    correlation_id varchar(128) not null,
    constraint ck_deposit_allocation_source check (
        (allocation_type = 'ORIGINAL' and source_allocation_id is null)
        or (allocation_type = 'TRANSFER_IN' and source_allocation_id is not null)
    )
);

create index ix_deposit_allocation_appointment on deposit_allocation (appointment_id, status);
create index ix_deposit_allocation_payment on deposit_allocation (payment_id, status);
create index ix_deposit_allocation_source on deposit_allocation (source_allocation_id) where source_allocation_id is not null;

-- Deposit allocation mutation protection (only status transitions permitted)
create or replace function reject_deposit_allocation_illegal_mutation()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'DELETE' or tg_op = 'TRUNCATE' then
        raise exception 'deposit_allocation rows are append-only and cannot be deleted or truncated'
            using errcode = '55000';
    end if;

    if tg_op = 'UPDATE' then
        if old.id <> new.id
            or old.payment_id <> new.payment_id
            or old.appointment_id <> new.appointment_id
            or old.amount <> new.amount
            or old.currency <> new.currency
            or old.allocation_type <> new.allocation_type
            or (old.source_allocation_id is distinct from new.source_allocation_id)
            or old.created_at <> new.created_at
            or old.correlation_id <> new.correlation_id then
            raise exception 'deposit_allocation financial and lineage attributes are immutable; only status may transition'
                using errcode = '55000';
        end if;
    end if;

    return new;
end;
$$;

create trigger trg_deposit_allocation_mutation_guard
before update or delete on deposit_allocation
for each row execute function reject_deposit_allocation_illegal_mutation();

create trigger trg_deposit_allocation_reject_truncate
before truncate on deposit_allocation
for each statement execute function reject_deposit_allocation_illegal_mutation();

-- 3. Create deposit_transfer table
create table deposit_transfer (
    id uuid primary key,
    old_appointment_id uuid not null references appointment(id) on delete restrict,
    new_appointment_id uuid not null references appointment(id) on delete restrict,
    source_allocation_id uuid not null references deposit_allocation(id) on delete restrict,
    target_allocation_id uuid not null references deposit_allocation(id) on delete restrict,
    amount numeric(19,2) not null check (amount > 0),
    currency varchar(3) not null check (currency ~ '^[A-Z]{3}$' and currency = 'VND'),
    difference_amount numeric(19,2) not null check (difference_amount >= 0),
    difference_disposition varchar(64) not null check (difference_disposition in ('NONE', 'ADDITIONAL_CAPTURE', 'REFUND_PENDING')),
    actor_account_id uuid references user_account(id) on delete restrict,
    reason text,
    correlation_id varchar(128) not null,
    created_at timestamptz not null,
    constraint ck_deposit_transfer_distinct_appointments check (old_appointment_id <> new_appointment_id),
    constraint uq_deposit_transfer_old_appointment unique (old_appointment_id)
);

create index ix_deposit_transfer_new_appointment on deposit_transfer (new_appointment_id);
create index ix_deposit_transfer_correlation on deposit_transfer (correlation_id);

-- Deposit transfer append-only protection
create or replace function reject_deposit_transfer_mutation()
returns trigger
language plpgsql
as $$
begin
    raise exception 'deposit_transfer rows are append-only and cannot be updated, deleted, or truncated'
        using errcode = '55000';
end;
$$;

create trigger trg_deposit_transfer_append_only
before update or delete on deposit_transfer
for each row execute function reject_deposit_transfer_mutation();

create trigger trg_deposit_transfer_reject_truncate
before truncate on deposit_transfer
for each statement execute function reject_deposit_transfer_mutation();

-- 4. Permissions and role mappings
insert into permission(id, action, description, created_at) values
    ('01980000-0000-7001-8000-00000000012f', 'appointment.reschedule', 'Reschedule appointment and transfer deposit', now())
on conflict (action) do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000005', id, now(), null from permission
where action in ('appointment.reschedule')
on conflict do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000004', id, now(), null from permission
where action in ('appointment.reschedule')
on conflict do nothing;

-- 5. Extend patient_account_link permission scope check constraint to allow appointment.reschedule delegation
alter table patient_account_link drop constraint ck_patient_account_link_scope;
alter table patient_account_link
    add constraint ck_patient_account_link_scope
    check (
        jsonb_typeof(permission_scope) = 'object'
        and permission_scope ? 'version'
        and permission_scope ->> 'version' = '1'
        and permission_scope - 'version' - 'patient.read' - 'slot_hold.create' - 'slot_hold.read' - 'slot_hold.cancel' - 'payment_intent.create' - 'payment_intent.read' - 'appointment.reschedule' = '{}'::jsonb
        and (not (permission_scope ? 'patient.read') or jsonb_typeof(permission_scope -> 'patient.read') = 'boolean')
        and (not (permission_scope ? 'slot_hold.create') or jsonb_typeof(permission_scope -> 'slot_hold.create') = 'boolean')
        and (not (permission_scope ? 'slot_hold.read') or jsonb_typeof(permission_scope -> 'slot_hold.read') = 'boolean')
        and (not (permission_scope ? 'slot_hold.cancel') or jsonb_typeof(permission_scope -> 'slot_hold.cancel') = 'boolean')
        and (not (permission_scope ? 'payment_intent.create') or jsonb_typeof(permission_scope -> 'payment_intent.create') = 'boolean')
        and (not (permission_scope ? 'payment_intent.read') or jsonb_typeof(permission_scope -> 'payment_intent.read') = 'boolean')
        and (not (permission_scope ? 'appointment.reschedule') or jsonb_typeof(permission_scope -> 'appointment.reschedule') = 'boolean')
    );

-- 6. Backfill ORIGINAL allocations for already-confirmed appointments
insert into deposit_allocation (
    id, payment_id, appointment_id, amount, currency, allocation_type, source_allocation_id, status, created_at, correlation_id
)
select
    gen_random_uuid(),
    p.id,
    a.id,
    p.amount,
    'VND',
    'ORIGINAL',
    null,
    'ACTIVE',
    p.created_at,
    'migration_backfill_r1_07'
from appointment a
join payment_intent pi on pi.slot_hold_id = a.slot_hold_id
join payment p on p.payment_intent_id = pi.id
where a.status = 'CONFIRMED'
  and p.status = 'CAPTURED'
on conflict do nothing;
