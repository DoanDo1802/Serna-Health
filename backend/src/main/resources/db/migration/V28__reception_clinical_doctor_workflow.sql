-- V28: Durable Doctor Examination Workflow by Visit / Encounter
-- Provides persistence for check-in, visit, encounter, participants, and versioned clinical notes.

-- 1. Visit table
create table if not exists visit (
    id uuid primary key,
    patient_id uuid not null references patient(id) on delete restrict,
    appointment_id uuid unique references appointment(id) on delete restrict,
    status varchar(64) not null check (status in ('ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ENTERED_IN_ERROR')),
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Check-In table
create table if not exists check_in (
    id uuid primary key,
    appointment_id uuid not null unique references appointment(id) on delete restrict,
    visit_id uuid not null references visit(id) on delete restrict,
    checked_in_at timestamptz not null default now(),
    checked_in_by_account_id uuid references user_account(id) on delete restrict,
    notes varchar(500),
    version bigint not null default 0,
    created_at timestamptz not null default now()
);

-- 3. Encounter table
create table if not exists encounter (
    id uuid primary key,
    visit_id uuid not null references visit(id) on delete restrict,
    patient_id uuid not null references patient(id) on delete restrict,
    department_id uuid not null references department(id) on delete restrict,
    status varchar(64) not null check (status in ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ENTERED_IN_ERROR')),
    start_at timestamptz,
    end_at timestamptz,
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 4. Encounter Participant table
create table if not exists encounter_participant (
    id uuid primary key,
    encounter_id uuid not null references encounter(id) on delete cascade,
    practitioner_role_id uuid not null references practitioner_role(id) on delete restrict,
    role_type varchar(64) not null default 'PRIMARY_PERFORMER' check (role_type in ('PRIMARY_PERFORMER', 'SECONDARY_PERFORMER', 'CONSULTANT')),
    status varchar(64) not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'WITHDRAWN')),
    created_at timestamptz not null default now(),
    constraint uq_encounter_participant unique (encounter_id, practitioner_role_id)
);

-- 5. Clinical Note table
create table if not exists clinical_note (
    id uuid primary key,
    encounter_id uuid not null references encounter(id) on delete restrict,
    patient_id uuid not null references patient(id) on delete restrict,
    note_type varchar(64) not null check (note_type in ('EXAMINATION', 'CONSULTATION', 'PROGRESS', 'DISCHARGE')),
    status varchar(64) not null check (status in ('DRAFT', 'FINALIZED', 'AMENDED', 'ENTERED_IN_ERROR')),
    current_version_id uuid,
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 6. Clinical Note Version table
create table if not exists clinical_note_version (
    id uuid primary key,
    clinical_note_id uuid not null references clinical_note(id) on delete restrict,
    version_number integer not null check (version_number >= 1),
    status varchar(64) not null check (status in ('DRAFT', 'FINALIZED', 'AMENDED', 'ENTERED_IN_ERROR')),
    content_schema_version varchar(32) not null default '1.0',
    content jsonb not null,
    digest varchar(64) not null,
    author_practitioner_role_id uuid not null references practitioner_role(id) on delete restrict,
    finalized_by_practitioner_role_id uuid references practitioner_role(id) on delete restrict,
    finalized_at timestamptz,
    amended_from_version_id uuid references clinical_note_version(id) on delete restrict,
    amendment_reason varchar(500),
    error_reason varchar(500),
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_clinical_note_version_number unique (clinical_note_id, version_number)
);

-- Link clinical_note to current_version_id
alter table clinical_note
    drop constraint if exists fk_clinical_note_current_version;
alter table clinical_note
    add constraint fk_clinical_note_current_version
    foreign key (current_version_id) references clinical_note_version(id) on delete restrict deferrable initially deferred;

-- 7. Immutability trigger for FINALIZED clinical note versions
create or replace function trg_clinical_note_version_immutability()
returns trigger as $$
begin
    if old.status = 'FINALIZED' then
        if tg_op = 'DELETE' then
            raise exception 'Cannot delete a FINALIZED clinical note version';
        end if;
        if tg_op = 'UPDATE' and (
            new.content is distinct from old.content or
            new.digest is distinct from old.digest or
            new.author_practitioner_role_id is distinct from old.author_practitioner_role_id or
            new.version_number is distinct from old.version_number or
            new.clinical_note_id is distinct from old.clinical_note_id or
            new.status not in ('FINALIZED', 'AMENDED', 'ENTERED_IN_ERROR')
        ) then
            raise exception 'Cannot modify immutable properties of a FINALIZED clinical note version';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clinical_note_version_immutability_guard on clinical_note_version;
create trigger trg_clinical_note_version_immutability_guard
before update or delete on clinical_note_version
for each row execute function trg_clinical_note_version_immutability();

-- 8. Query indexes
create index if not exists idx_visit_patient on visit(patient_id);
create index if not exists idx_visit_appointment on visit(appointment_id);
create index if not exists idx_encounter_visit on encounter(visit_id);
create index if not exists idx_encounter_patient on encounter(patient_id);
create index if not exists idx_encounter_department on encounter(department_id);
create index if not exists idx_encounter_status on encounter(status);
create index if not exists idx_encounter_participant_role on encounter_participant(practitioner_role_id, status);
create index if not exists idx_clinical_note_encounter on clinical_note(encounter_id);
create index if not exists idx_clinical_note_patient on clinical_note(patient_id);
create index if not exists idx_clinical_note_version_note on clinical_note_version(clinical_note_id, version_number);

-- 9. Permissions & Role Mapping
insert into permission(id, action, description, created_at) values
    ('01980000-0000-7001-8000-000000000140', 'checkin.execute', 'Execute patient check-in for appointment', now()),
    ('01980000-0000-7001-8000-000000000141', 'checkin.read', 'Read check-in records', now()),
    ('01980000-0000-7001-8000-000000000142', 'visit.read', 'Read visit records', now()),
    ('01980000-0000-7001-8000-000000000143', 'visit.complete', 'Complete visit', now()),
    ('01980000-0000-7001-8000-000000000144', 'visit.cancel', 'Cancel visit', now()),
    ('01980000-0000-7001-8000-000000000145', 'visit.enter_in_error', 'Mark visit entered in error', now()),
    ('01980000-0000-7001-8000-000000000146', 'encounter.read', 'Read encounter records', now()),
    ('01980000-0000-7001-8000-000000000147', 'encounter.start', 'Start examination encounter', now()),
    ('01980000-0000-7001-8000-000000000148', 'encounter.complete', 'Complete examination encounter', now()),
    ('01980000-0000-7001-8000-000000000149', 'encounter.cancel', 'Cancel encounter', now()),
    ('01980000-0000-7001-8000-00000000014a', 'encounter.enter_in_error', 'Mark encounter entered in error', now()),
    ('01980000-0000-7001-8000-00000000014b', 'encounter.write', 'Create and update draft clinical data', now()),
    ('01980000-0000-7001-8000-00000000014c', 'clinical.note.read', 'Read clinical notes and versions', now()),
    ('01980000-0000-7001-8000-00000000014d', 'clinical.note.finalize', 'Finalize clinical note version', now()),
    ('01980000-0000-7001-8000-00000000014e', 'clinical.version.amend', 'Amend finalized clinical note version', now()),
    ('01980000-0000-7001-8000-00000000014f', 'clinical.version.enter_in_error', 'Mark clinical version entered in error', now())
on conflict (action) do nothing;

-- Grant permissions to DOCTOR role
insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000003', id, now(), null
from permission
where action in (
    'checkin.execute',
    'checkin.read',
    'visit.read',
    'encounter.read',
    'encounter.start',
    'encounter.complete',
    'encounter.write',
    'clinical.note.read',
    'clinical.note.finalize',
    'clinical.version.amend',
    'clinical.version.enter_in_error'
)
on conflict do nothing;

-- Grant permissions to IDENTITY_ADMINISTRATOR role
insert into role_permission(role_id, permission_id, granted_at, granted_by_account_id)
select '01980000-0000-7000-8000-000000000001', id, now(), null
from permission
where action in (
    'checkin.execute',
    'checkin.read',
    'visit.read',
    'visit.complete',
    'visit.cancel',
    'visit.enter_in_error',
    'encounter.read',
    'encounter.start',
    'encounter.complete',
    'encounter.cancel',
    'encounter.enter_in_error',
    'encounter.write',
    'clinical.note.read',
    'clinical.note.finalize',
    'clinical.version.amend',
    'clinical.version.enter_in_error'
)
on conflict do nothing;
