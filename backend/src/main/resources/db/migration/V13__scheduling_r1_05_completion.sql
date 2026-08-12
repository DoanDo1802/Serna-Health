-- R1-05 capacity-safe AppointmentSlot and SlotHold completion. V5 remains immutable.

update slot_hold set status = 'RELEASED' where status = 'CANCELLED';
update slot_hold set status = 'CONSUMED' where status = 'FULFILLED';

alter table slot_hold drop constraint if exists slot_hold_status_check;
alter table slot_hold drop constraint if exists uq_slot_hold_idempotency;
alter table slot_hold
    alter column idempotency_scope drop not null,
    alter column idempotency_key drop not null,
    alter column request_hash drop not null,
    add constraint ck_slot_hold_status
    check (status in ('ACTIVE', 'CONSUMED', 'EXPIRED', 'RELEASED'));

create table appointment (
    id uuid primary key,
    patient_id uuid not null references patient(id) on delete restrict,
    slot_hold_id uuid references slot_hold(id) on delete restrict,
    slot_id uuid not null references appointment_slot(id) on delete restrict,
    status varchar(64) not null check (status in ('CONFIRMED', 'FULFILLED')),
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create index ix_appointment_slot_capacity on appointment (slot_id, status)
    where status in ('CONFIRMED', 'FULFILLED');
create index ix_slot_hold_slot_active_expiry on slot_hold (slot_id, expires_at, id)
    where status = 'ACTIVE';

insert into permission(id, action, description, created_at) values
    ('01980000-0000-7001-8000-000000000125', 'appointment_slot.read', 'Read appointment slots', now()),
    ('01980000-0000-7001-8000-000000000126', 'appointment_slot.create', 'Create appointment slots', now()),
    ('01980000-0000-7001-8000-000000000127', 'appointment_slot.update', 'Update appointment slots', now()),
    ('01980000-0000-7001-8000-000000000128', 'appointment_slot.cancel', 'Cancel appointment slots', now()),
    ('01980000-0000-7001-8000-000000000129', 'slot_hold.create', 'Create slot holds', now()),
    ('01980000-0000-7001-8000-00000000012a', 'slot_hold.read', 'Read slot holds', now()),
    ('01980000-0000-7001-8000-00000000012b', 'slot_hold.cancel', 'Release slot holds', now())
on conflict (action) do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000004', id, now(), null from permission
where action in ('appointment_slot.read', 'appointment_slot.create', 'appointment_slot.update', 'appointment_slot.cancel')
on conflict do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000005', id, now(), null from permission
where action in ('appointment_slot.read', 'slot_hold.create', 'slot_hold.read', 'slot_hold.cancel')
on conflict do nothing;
