---
aliases:
  - Reception clinical schema R1
artifact_type: r1-schema-contract
status: ACCEPTED
module_owners:
  - reception-queue
  - clinical-care
---
# Reception và clinical — R1

## Reception tables

### `check_in`

**Owner / tranche / purpose:** `reception-queue` / R1 / staff-assisted idempotent check-in.

Columns: `id uuid`, appointment/visit/actor account UUIDs, `channel varchar(64)`, `occurred_at timestamptz`, `exception boolean default false`, `exception_reason varchar(500) null`, correlation ID, created_at. All identity fields not null. PK/FKs RESTRICT; unique appointment; unique visit; exception reason iff exception; channel R1 `STAFF_ASSISTED`. Index actor/time, occurred time.

HTTP/API replay remains owned by `platform-audit.idempotency_record`; do not duplicate idempotency scope/key/request-hash columns in this business table.

### `visit`

Columns: `id uuid`, patient UUID, appointment UUID nullable, `visit_type varchar(64)`, `status varchar(64)`, `completion_warnings jsonb null`, `version bigint`, timestamps. PK/FKs; partial unique appointment non-null; type `APPOINTMENT/WALK_IN`; status `ARRIVED/IN_PROGRESS/COMPLETED/CANCELLED/ENTERED_IN_ERROR`; appointment required for APPOINTMENT and null for WALK_IN; terminal reason stored by audited command. Index patient/status/time, appointment.

### `encounter`

Columns: `id uuid`, visit/department UUIDs, room UUID nullable, `started_at/ended_at timestamptz null`, `status varchar(64)`, `terminal_reason varchar(500) null`, `version bigint`, timestamps. PK/FKs RESTRICT; status `PLANNED/IN_PROGRESS/COMPLETED/CANCELLED/ENTERED_IN_ERROR`; start/end/state timestamp checks; terminal reason for cancelled/error. Index visit/status, department/status/time.

### `encounter_participant`

Columns: `id uuid`, encounter/practitioner_role UUIDs, `participant_type varchar(64)`, effective_from/to timestamptz, `status varchar(64)`, created_at. PK/FKs; valid interval; status ACTIVE/ENDED/ENTERED_IN_ERROR; no duplicate active semantic assignment; index role/time and encounter/status.

### `queue_policy`

Columns: `id uuid`, department UUID, `current_ratio integer`, `carry_over_ratio integer`, effective interval, `status varchar(64)`, `version bigint`, timestamps. PK/FK; ratios >0; one active policy/department/time via exclusion; R1 default 3/1. Index department/time/status.

### `queue_entry`

Columns: `id uuid`, encounter/policy/department UUIDs, room UUID nullable, `service_date date`, `queue_number integer`, checked_in/called/service_started/completed timestamps nullable, `status varchar(64)`, `version bigint`, timestamps. PK/FKs; queue_number >0; unique `(service_date,department_id,queue_number)`; partial unique encounter for active states WAITING/CALLED/IN_SERVICE/DEFERRED; timestamp/state ordering checks. Index department/date/status/order, room/status, encounter/history.

### `queue_adjustment`

Columns: `id uuid`, queue_entry/actor account UUIDs, before/after `jsonb`, `adjusted_at timestamptz`, `reason varchar(500)`, correlation ID. PK/FKs; nonblank reason; before != after; append-only. Index entry/time, actor/time.

## Clinical tables

### `clinical_note`

**Owner / tranche / purpose:** `clinical-care` / R1 / note identity.

Columns: `id uuid`, encounter UUID, `note_type varchar(64)`, `current_version_id uuid null`, `version bigint`, timestamps. PK/FK Encounter; current version FK deferred after version table creation; unique active semantic `(encounter_id,note_type)` if policy one note/type; current version must belong same note enforced transaction. Index encounter/type.

### `clinical_note_version`

| Column | PostgreSQL type | Null/default | Contract |
|---|---|---|---|
| `id` | `uuid` | not null | UUIDv7 PK |
| `note_id` | `uuid` | not null | FK ClinicalNote |
| `previous_version_id` | `uuid` | null | self-FK, same note |
| `version_number` | `integer` | not null | starts 1, unique per note |
| `author_role_id` | `uuid` | not null | FK PractitionerRole |
| `finalizer_role_id` | `uuid` | null | required FINALIZED |
| `status` | `varchar(64)` | not null | DRAFT/FINALIZED/ENTERED_IN_ERROR |
| `content` | `jsonb` | not null | schema-versioned note payload |
| `content_schema_version` | `varchar(32)` | not null | validator selection |
| `content_digest` | `varchar(128)` | null | required FINALIZED |
| `digest_algorithm` | `varchar(32)` | null | R1 `SHA-256`; required FINALIZED |
| `reason` | `varchar(500)` | null | required amendment/error |
| `finalized_at` | `timestamptz` | null | required FINALIZED |
| `created_at` | `timestamptz` | not null | immutable |

Constraints: PK/FKs RESTRICT; unique `(note_id,version_number)`; partial unique one DRAFT/note; previous same note and lower version; FINALIZED requires finalizer/digest/algorithm/time and becomes payload immutable; entered error requires reason. Index note/status/version, finalizer/time.

States: DRAFT → FINALIZED or ENTERED_IN_ERROR. FINALIZED cannot transition/update; amendment inserts new DRAFT and updates note.current_version_id under note lock.

### `diagnosis`

Columns: `id uuid`, encounter UUID, current_version UUID null, version bigint, timestamps. PK/FKs; index encounter.

### `diagnosis_version`

Columns: id, diagnosis/previous version UUIDs, version_number integer, author/finalizer PractitionerRole UUIDs, `code_system/code/display varchar(128/128/500) null`, `free_text text null`, `diagnosis_type varchar(64)`, `clinical_status varchar(64)`, `status varchar(64)`, digest/algorithm/finalized_at/reason, created_at. Same version/finalization constraints as note; at least code or nonblank free_text; coded triple consistency; one DRAFT/diagnosis. Index diagnosis/version/status, code system/code, clinical status.

### `service_delivery`

**Owner / tranche / purpose:** `clinical-care` / R1 / evidence dịch vụ thực hiện; billing consumes event/API.

Columns: `id uuid`, encounter/service/performed_by_role UUIDs, `quantity numeric(12,3)`, `performed_at timestamptz null`, `status varchar(64)`, `version bigint`, timestamps. PK/FKs RESTRICT; quantity >0; PERFORMED requires performed_at/performer; cancelled/error require audited reason supplied command/audit. Index encounter/status, service/performed time.

HTTP/API replay remains owned by `platform-audit.idempotency_record`; do not duplicate idempotency scope/key/request-hash columns in this business table.

`prescription` và `prescription_item` là MVP-LATER, không thuộc active R1 migration. `ElectronicAttestation` không FK vào clinical R1 technical versions.

## Trace

| Story | Decisions | ADR | Scenarios |
|---|---|---|---|
| `R1-08` | `CHECKIN-01`, `QUEUE-01..03` | ADR-0005 | `SC-R1-CHECKIN-01..02` |
| `R1-09` | `QUEUE-06..07` | ADR-0005 | `SC-R1-QUEUE-01` |
| `R1-10` | `CLIN-01`, `CLIN-02`, `CLIN-04` | ADR-0007/0012 | `SC-R1-CLIN-01..02` |
| `R1-11` | `BILL-06` | ADR-0006 | `SC-R1-BILL-01` |

Related: [[../06-ho-so-suc-khoe-va-kham|Clinical]], [[../22-backlog-mvp|Backlog]], [[README|Schema conventions]].
