CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE appointment_slot (
    id uuid primary key,
    practitioner_role_id uuid not null references practitioner_role(id) on delete restrict,
    department_id uuid not null references department(id) on delete restrict,
    room_id uuid not null references room(id) on delete restrict,
    service_id uuid not null references service(id) on delete restrict,
    session varchar(64) not null check (session in ('MORNING', 'AFTERNOON')),
    start_at timestamptz not null,
    end_at timestamptz not null check (end_at > start_at),
    capacity integer not null check (capacity > 0),
    status varchar(64) not null check (status in ('ACTIVE', 'CANCELLED', 'REPLACED')),
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    
    constraint ex_appointment_slot_role_overlap exclude using gist (
        practitioner_role_id with =,
        tstzrange(start_at, end_at) with &&
    ) where (status = 'ACTIVE'),
    
    constraint ex_appointment_slot_room_overlap exclude using gist (
        room_id with =,
        tstzrange(start_at, end_at) with &&
    ) where (status = 'ACTIVE')
);

CREATE INDEX idx_appointment_slot_service_start_status on appointment_slot(service_id, start_at, status);
CREATE INDEX idx_appointment_slot_role_start on appointment_slot(practitioner_role_id, start_at);
CREATE INDEX idx_appointment_slot_department_start on appointment_slot(department_id, start_at);

CREATE TABLE slot_hold (
    id uuid primary key,
    slot_id uuid not null references appointment_slot(id) on delete restrict,
    patient_id uuid not null references patient(id) on delete restrict,
    expires_at timestamptz not null,
    deposit_amount numeric(19,2) not null check (deposit_amount >= 0),
    currency char(3) not null check (currency = 'VND'),
    idempotency_scope varchar(128) not null,
    idempotency_key varchar(128) not null,
    request_hash varchar(128) not null,
    status varchar(64) not null check (status in ('ACTIVE', 'CANCELLED', 'FULFILLED', 'EXPIRED')),
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    
    constraint ck_slot_hold_expires check (expires_at > created_at),
    constraint uq_slot_hold_idempotency unique (idempotency_scope, idempotency_key)
);

CREATE INDEX idx_slot_hold_active_expiry on slot_hold(expires_at) where status = 'ACTIVE';
CREATE INDEX idx_slot_hold_slot_status on slot_hold(slot_id, status);
