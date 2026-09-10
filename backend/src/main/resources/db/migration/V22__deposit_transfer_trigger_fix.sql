-- Fix PL/pgSQL composite type field resolution in deposit transfer completion triggers.
-- When a trigger function attaches to multiple tables, references to columns that do not exist
-- on all tables fail with 'record "new" has no field "..."'.
-- We split the constraint trigger logic into table-specific functions.

create or replace function validate_deposit_transfer_complete()
returns trigger
language plpgsql
as $$
declare
    transfer_amount numeric(19,2);
    leg_total numeric(19,2);
    leg_count bigint;
begin
    transfer_amount := new.amount;
    select count(*), coalesce(sum(amount), 0)
        into leg_count, leg_total
        from deposit_transfer_leg
        where deposit_transfer_id = new.id;
    if transfer_amount is null or leg_count = 0 or leg_total <> transfer_amount then
        raise exception 'deposit_transfer legs must exactly fund transfer amount'
            using errcode = '23514';
    end if;
    return null;
end;
$$;

create or replace function validate_deposit_transfer_leg_complete()
returns trigger
language plpgsql
as $$
declare
    transfer_amount numeric(19,2);
    leg_total numeric(19,2);
    leg_count bigint;
begin
    select amount into transfer_amount from deposit_transfer where id = new.deposit_transfer_id;
    select count(*), coalesce(sum(amount), 0)
        into leg_count, leg_total
        from deposit_transfer_leg
        where deposit_transfer_id = new.deposit_transfer_id;
    if transfer_amount is null or leg_count = 0 or leg_total <> transfer_amount then
        raise exception 'deposit_transfer legs must exactly fund transfer amount'
            using errcode = '23514';
    end if;
    return null;
end;
$$;

drop trigger if exists trg_deposit_transfer_legs_complete on deposit_transfer;
create constraint trigger trg_deposit_transfer_legs_complete
after insert on deposit_transfer
deferrable initially deferred
for each row execute function validate_deposit_transfer_complete();

drop trigger if exists trg_deposit_transfer_leg_total_guard on deposit_transfer_leg;
create constraint trigger trg_deposit_transfer_leg_total_guard
after insert on deposit_transfer_leg
deferrable initially deferred
for each row execute function validate_deposit_transfer_leg_complete();

create or replace function validate_deposit_transfer_legs_complete()
returns trigger
language plpgsql
as $$
begin
    return null;
end;
$$;
