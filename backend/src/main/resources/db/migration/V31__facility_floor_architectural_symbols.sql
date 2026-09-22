-- V31: semantic architectural drawing symbols over persistent rectangular room layout.

create table facility_floor_symbol (
    id uuid primary key,
    floor_id uuid not null references facility_floor(id) on delete restrict,
    symbol_type varchar(32) not null,
    label varchar(200) not null,
    geometry jsonb not null,
    z_index integer not null default 0,
    version bigint not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint ck_facility_floor_symbol_type check (symbol_type in (
        'WALL_STRAIGHT', 'WALL_CURVED', 'PARTITION', 'DOOR',
        'STAIRS', 'ELEVATOR', 'WC', 'SKYWELL')),
    constraint ck_facility_floor_symbol_label_nonblank check (btrim(label) <> ''),
    constraint ck_facility_floor_symbol_geometry_object check (jsonb_typeof(geometry) = 'object')
);

create index ix_facility_floor_symbol_floor on facility_floor_symbol(floor_id, z_index, id);
