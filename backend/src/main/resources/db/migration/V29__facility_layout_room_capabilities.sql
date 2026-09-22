-- V29: standalone physical rooms, operational capability mappings, and persistent facility layout.
-- Existing room.department_id remains for rollback compatibility; new writes use room_department.

alter table room alter column department_id drop not null;

create table room_department (
    room_id uuid not null references room(id) on delete restrict,
    department_id uuid not null references department(id) on delete restrict,
    created_at timestamptz not null default now(),
    primary key (room_id, department_id)
);

create table room_service (
    room_id uuid not null references room(id) on delete restrict,
    service_id uuid not null references service(id) on delete restrict,
    created_at timestamptz not null default now(),
    primary key (room_id, service_id)
);

insert into room_department(room_id, department_id, created_at)
select id, department_id, created_at
from room
where department_id is not null
on conflict do nothing;

create index ix_room_department_department on room_department(department_id, room_id);
create index ix_room_service_service on room_service(service_id, room_id);

create table facility_floor (
    id uuid primary key,
    code varchar(64) not null,
    name varchar(200) not null,
    level integer not null,
    description varchar(1000),
    grid_columns integer not null,
    grid_rows integer not null,
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uk_facility_floor_code unique (code),
    constraint uk_facility_floor_level unique (level),
    constraint ck_facility_floor_code_nonblank check (btrim(code) <> ''),
    constraint ck_facility_floor_name_nonblank check (btrim(name) <> ''),
    constraint ck_facility_floor_grid_columns check (grid_columns between 1 and 100),
    constraint ck_facility_floor_grid_rows check (grid_rows between 1 and 100)
);

create table facility_floor_element (
    id uuid primary key,
    floor_id uuid not null references facility_floor(id) on delete restrict,
    room_id uuid references room(id) on delete restrict,
    element_type varchar(32) not null,
    label varchar(200) not null,
    grid_x integer not null,
    grid_y integer not null,
    grid_width integer not null,
    grid_height integer not null,
    z_index integer not null default 0,
    door_side varchar(8),
    notes varchar(1000),
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint ck_facility_floor_element_type check (element_type in (
        'ROOM', 'WALKWAY', 'ELEVATOR', 'STAIRS', 'WC', 'RECEPTION', 'EQUIPMENT',
        'WAITING_AREA', 'EMERGENCY_EXIT', 'OTHER')),
    constraint ck_facility_floor_element_label_nonblank check (btrim(label) <> ''),
    constraint ck_facility_floor_element_geometry check (
        grid_x >= 0 and grid_y >= 0 and grid_width >= 1 and grid_height >= 1),
    constraint ck_facility_floor_element_door_side check (door_side is null or door_side in ('NORTH', 'EAST', 'SOUTH', 'WEST')),
    constraint ck_facility_floor_element_room_type check (
        (element_type = 'ROOM' and room_id is not null) or (element_type <> 'ROOM' and room_id is null))
);

create unique index ux_facility_floor_element_room
    on facility_floor_element(room_id) where room_id is not null;
create index ix_facility_floor_element_floor on facility_floor_element(floor_id, grid_y, grid_x);

insert into permission(id, action, description, created_at) values
    ('01980000-0000-7001-8000-000000000150', 'floorplan.read', 'Read persistent facility floor plans', now()),
    ('01980000-0000-7001-8000-000000000151', 'floorplan.manage', 'Create and edit persistent facility floor plans', now())
on conflict (action) do nothing;

insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000001', id, now(), null
from permission
where action in ('floorplan.read', 'floorplan.manage')
on conflict do nothing;
