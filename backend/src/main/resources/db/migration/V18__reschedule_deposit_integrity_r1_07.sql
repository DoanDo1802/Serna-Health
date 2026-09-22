-- R1-07 integrity hardening. Never rewrite V16 after deployment.

create table reschedule_top_up (
    id uuid primary key,
    payment_intent_id uuid not null unique references payment_intent(id) on delete restrict,
    old_appointment_id uuid not null references appointment(id) on delete restrict,
    old_appointment_version bigint not null check (old_appointment_version >= 0),
    target_slot_hold_id uuid not null references slot_hold(id) on delete restrict,
    amount numeric(19,2) not null check (amount > 0),
    currency varchar(3) not null check (currency = 'VND'),
    actor_account_id uuid references user_account(id) on delete restrict,
    reason text,
    correlation_id varchar(128) not null,
    status varchar(32) not null check (status in ('PENDING', 'CONSUMED', 'ENTERED_IN_ERROR')),
    created_at timestamptz not null,
    consumed_at timestamptz
);

create unique index uq_reschedule_top_up_pending_appointment
    on reschedule_top_up (old_appointment_id)
    where status = 'PENDING';

-- Allocation financial data remains immutable. Status is a forward-only lifecycle.
create or replace function reject_deposit_allocation_illegal_mutation()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'DELETE' or tg_op = 'TRUNCATE' then
        raise exception 'deposit_allocation rows are append-only and cannot be deleted or truncated'
            using errcode = '55000';
    end if;

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

    if old.status = new.status then
        return new;
    end if;
    if old.status = 'ACTIVE' and new.status in ('TRANSFERRED', 'REFUND_PENDING', 'ENTERED_IN_ERROR') then
        return new;
    end if;
    if old.status = 'REFUND_PENDING' and new.status in ('REFUNDED', 'ENTERED_IN_ERROR') then
        return new;
    end if;
    raise exception 'deposit_allocation status transition % -> % is not allowed', old.status, new.status
        using errcode = '55000';
end;
$$;

-- Every transfer target must retain source provenance and no source may be reused
-- by two active transfer-in rows for the same replacement appointment.
create unique index if not exists uq_deposit_allocation_target_source
    on deposit_allocation (appointment_id, source_allocation_id)
    where allocation_type = 'TRANSFER_IN' and status = 'ACTIVE';

create or replace function validate_deposit_transfer_lineage()
returns trigger
language plpgsql
as $$
declare
    source_appointment uuid;
    target_appointment uuid;
    target_source uuid;
    old_to uuid;
    new_from uuid;
begin
    select appointment_id into source_appointment from deposit_allocation where id = new.source_allocation_id;
    select appointment_id, source_allocation_id into target_appointment, target_source
        from deposit_allocation where id = new.target_allocation_id;
    select rescheduled_to_id into old_to from appointment where id = new.old_appointment_id;
    select rescheduled_from_id into new_from from appointment where id = new.new_appointment_id;

    if source_appointment is distinct from new.old_appointment_id
        or target_appointment is distinct from new.new_appointment_id
        or target_source is distinct from new.source_allocation_id
        or old_to is distinct from new.new_appointment_id
        or new_from is distinct from new.old_appointment_id then
        raise exception 'deposit_transfer must match reciprocal appointment and allocation lineage'
            using errcode = '23514';
    end if;
    return new;
end;
$$;

create trigger trg_deposit_transfer_lineage_guard
before insert on deposit_transfer
for each row execute function validate_deposit_transfer_lineage();

-- Transfer parent remains API command record; immutable legs retain every source allocation.
create table deposit_transfer_leg (
    id uuid primary key,
    deposit_transfer_id uuid not null references deposit_transfer(id) on delete restrict,
    source_allocation_id uuid not null references deposit_allocation(id) on delete restrict,
    target_allocation_id uuid not null references deposit_allocation(id) on delete restrict,
    amount numeric(19,2) not null check (amount > 0),
    currency varchar(3) not null check (currency = 'VND'),
    created_at timestamptz not null,
    constraint uq_deposit_transfer_leg_source unique (deposit_transfer_id, source_allocation_id),
    constraint uq_deposit_transfer_leg_target unique (deposit_transfer_id, target_allocation_id)
);

insert into deposit_transfer_leg (
    id, deposit_transfer_id, source_allocation_id, target_allocation_id, amount, currency, created_at
)
select gen_random_uuid(), id, source_allocation_id, target_allocation_id, amount, currency, created_at
from deposit_transfer;

create or replace function reject_deposit_transfer_leg_mutation()
returns trigger
language plpgsql
as $$
begin
    raise exception 'deposit_transfer_leg rows are append-only and cannot be updated, deleted, or truncated'
        using errcode = '55000';
end;
$$;

create trigger trg_deposit_transfer_leg_append_only
before update or delete on deposit_transfer_leg
for each row execute function reject_deposit_transfer_leg_mutation();

create trigger trg_deposit_transfer_leg_reject_truncate
before truncate on deposit_transfer_leg
for each statement execute function reject_deposit_transfer_leg_mutation();

create or replace function validate_deposit_transfer_leg_lineage()
returns trigger
language plpgsql
as $$
declare
    transfer_old_appointment uuid;
    transfer_new_appointment uuid;
    transfer_currency varchar(3);
    source_appointment uuid;
    source_currency varchar(3);
    source_status varchar(64);
    target_appointment uuid;
    target_source uuid;
    target_currency varchar(3);
    target_status varchar(64);
    target_type varchar(64);
begin
    select old_appointment_id, new_appointment_id, currency
        into transfer_old_appointment, transfer_new_appointment, transfer_currency
        from deposit_transfer where id = new.deposit_transfer_id;
    select appointment_id, currency, status
        into source_appointment, source_currency, source_status
        from deposit_allocation where id = new.source_allocation_id;
    select appointment_id, source_allocation_id, currency, status, allocation_type
        into target_appointment, target_source, target_currency, target_status, target_type
        from deposit_allocation where id = new.target_allocation_id;

    if transfer_old_appointment is null
        or source_appointment is distinct from transfer_old_appointment
        or target_appointment is distinct from transfer_new_appointment
        or target_source is distinct from new.source_allocation_id
        or source_status <> 'TRANSFERRED'
        or target_status <> 'ACTIVE'
        or target_type <> 'TRANSFER_IN'
        or source_currency <> new.currency
        or target_currency <> new.currency
        or transfer_currency <> new.currency
        or new.amount <> (select amount from deposit_allocation where id = new.target_allocation_id) then
        raise exception 'deposit_transfer_leg must match transferred source, active target, and transfer lineage'
            using errcode = '23514';
    end if;
    return new;
end;
$$;

create trigger trg_deposit_transfer_leg_lineage_guard
before insert on deposit_transfer_leg
for each row execute function validate_deposit_transfer_leg_lineage();

create or replace function validate_deposit_transfer_legs_complete()
returns trigger
language plpgsql
as $$
declare
    transfer_id uuid;
    transfer_amount numeric(19,2);
    leg_total numeric(19,2);
    leg_count bigint;
begin
    transfer_id := case when tg_table_name = 'deposit_transfer' then new.id else new.deposit_transfer_id end;
    select amount into transfer_amount from deposit_transfer where id = transfer_id;
    select count(*), coalesce(sum(amount), 0)
        into leg_count, leg_total
        from deposit_transfer_leg
        where deposit_transfer_id = transfer_id;
    if transfer_amount is null or leg_count = 0 or leg_total <> transfer_amount then
        raise exception 'deposit_transfer legs must exactly fund transfer amount'
            using errcode = '23514';
    end if;
    return null;
end;
$$;

create constraint trigger trg_deposit_transfer_legs_complete
after insert on deposit_transfer
deferrable initially deferred
for each row execute function validate_deposit_transfer_legs_complete();

create constraint trigger trg_deposit_transfer_leg_total_guard
after insert on deposit_transfer_leg
deferrable initially deferred
for each row execute function validate_deposit_transfer_legs_complete();

-- Top-up command context is immutable except for one forward terminal transition.
create or replace function reject_reschedule_top_up_illegal_mutation()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'DELETE' or tg_op = 'TRUNCATE' then
        raise exception 'reschedule_top_up rows are append-only and cannot be deleted or truncated'
            using errcode = '55000';
    end if;
    if old.id <> new.id
        or old.payment_intent_id <> new.payment_intent_id
        or old.old_appointment_id <> new.old_appointment_id
        or old.old_appointment_version <> new.old_appointment_version
        or old.target_slot_hold_id <> new.target_slot_hold_id
        or old.amount <> new.amount
        or old.currency <> new.currency
        or (old.actor_account_id is distinct from new.actor_account_id)
        or (old.reason is distinct from new.reason)
        or old.correlation_id <> new.correlation_id
        or old.created_at <> new.created_at then
        raise exception 'reschedule_top_up command attributes are immutable; only status may transition'
            using errcode = '55000';
    end if;
    if old.status = new.status and old.consumed_at is not distinct from new.consumed_at then
        return new;
    end if;
    if old.status = 'PENDING' and new.status in ('CONSUMED', 'ENTERED_IN_ERROR') then
        if new.status = 'CONSUMED' and new.consumed_at is null then
            raise exception 'consumed reschedule_top_up requires consumed_at' using errcode = '23514';
        end if;
        return new;
    end if;
    raise exception 'reschedule_top_up status transition % -> % is not allowed', old.status, new.status
        using errcode = '55000';
end;
$$;

create trigger trg_reschedule_top_up_mutation_guard
before update or delete on reschedule_top_up
for each row execute function reject_reschedule_top_up_illegal_mutation();

create trigger trg_reschedule_top_up_reject_truncate
before truncate on reschedule_top_up
for each statement execute function reject_reschedule_top_up_illegal_mutation();
