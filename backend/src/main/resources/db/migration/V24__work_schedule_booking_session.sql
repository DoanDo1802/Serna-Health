-- Doctor work schedules materialize exact appointment slots behind patient-facing booking sessions.

create table booking_session (
    id uuid primary key,
    department_id uuid not null references department(id) on delete restrict,
    service_id uuid not null references service(id) on delete restrict,
    local_date date not null,
    session varchar(64) not null check (session in ('MORNING', 'AFTERNOON')),
    start_at timestamptz not null,
    end_at timestamptz not null check (end_at > start_at),
    status varchar(64) not null check (status in ('ACTIVE', 'CANCELLED')),
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create unique index ux_booking_session_active_bucket
    on booking_session (department_id, service_id, local_date, session)
    where status = 'ACTIVE';
create index ix_booking_session_active_start
    on booking_session (local_date, session, start_at, id)
    where status = 'ACTIVE';

create table work_schedule (
    id uuid primary key,
    booking_session_id uuid not null references booking_session(id) on delete restrict,
    practitioner_role_id uuid not null references practitioner_role(id) on delete restrict,
    room_id uuid not null references room(id) on delete restrict,
    capacity integer not null check (capacity > 0),
    status varchar(64) not null check (status in ('ACTIVE', 'CANCELLED')),
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create index ix_work_schedule_active_session
    on work_schedule (booking_session_id, practitioner_role_id, id)
    where status = 'ACTIVE';
create index ix_work_schedule_active_role
    on work_schedule (practitioner_role_id, status);

alter table appointment_slot add column work_schedule_id uuid
    references work_schedule(id) on delete restrict;
create unique index ux_appointment_slot_work_schedule
    on appointment_slot (work_schedule_id)
    where work_schedule_id is not null;
create index ix_appointment_slot_active_work_schedule
    on appointment_slot (work_schedule_id, start_at, id)
    where status = 'ACTIVE' and work_schedule_id is not null;

insert into permission(id, action, description, created_at) values
    ('01980000-0000-7001-8000-000000000132', 'work_schedule.create', 'Create doctor work schedules', now()),
    ('01980000-0000-7001-8000-000000000133', 'work_schedule.read', 'Read doctor work schedules', now()),
    ('01980000-0000-7001-8000-000000000134', 'work_schedule.update', 'Update doctor work schedules', now()),
    ('01980000-0000-7001-8000-000000000135', 'work_schedule.cancel', 'Cancel doctor work schedules', now())
on conflict (action) do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000001', id, now(), null
from permission
where action in ('work_schedule.create', 'work_schedule.read', 'work_schedule.update', 'work_schedule.cancel')
on conflict do nothing;
