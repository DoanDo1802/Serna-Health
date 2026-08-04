---
aliases:
  - Catalog patient schema R1
artifact_type: r1-schema-contract
status: ACCEPTED
module_owners:
  - catalog
  - patient
---
# Catalog và Patient — R1

## Catalog tables

### `department`

**Owner / tranche / purpose:** `catalog` / R1 / khoa/phòng canonical.

Columns: `id uuid not null`, `code varchar(64) not null`, `name varchar(200) not null`, `active boolean not null default true`, `effective_from timestamptz not null`, `effective_to timestamptz null`, `version bigint not null default 0`, `created_at/updated_at timestamptz not null`.

Constraints: PK; unique code; nonblank code/name; effective_to null or greater effective_from. Index active/effective time.

### `room`

Columns: `id uuid not null`, `department_id uuid not null`, `code varchar(64) not null`, `name varchar(200) not null`, `active boolean not null default true`, `version bigint not null default 0`, timestamps. PK; FK Department RESTRICT; unique `(department_id,code)`; nonblank checks. Index department/active.

### `service`

Columns: `id uuid not null`, `code varchar(64) not null`, `name varchar(200) not null`, `service_type varchar(64) not null`, `active boolean not null default true`, `allows_critical boolean not null default false`, `version bigint not null default 0`, timestamps. PK; unique code; type check; R1 check `allows_critical=false`. Index type/active.

### `service_price`

Columns: `id uuid not null`, `service_id uuid not null`, `amount numeric(19,2) not null`, `currency char(3) not null default 'VND'`, `effective_from timestamptz not null`, `effective_to timestamptz null`, `created_at timestamptz not null`. PK; FK Service RESTRICT; amount >= 0; currency VND; valid interval; exclusion constraint prevents overlapping ranges per service/currency. Index service/effective time.

### `practitioner`

Columns: `id uuid not null`, `user_account_id uuid null`, `staff_code varchar(64) not null`, `full_name varchar(200) not null`, `active boolean not null default true`, `version bigint not null default 0`, timestamps. PK; FK UserAccount RESTRICT; unique staff_code; partial unique user_account_id when non-null; nonblank checks. Index active/name.

### `practitioner_role`

Columns: `id uuid not null`, `practitioner_id uuid not null`, `department_id uuid not null`, `role_code varchar(64) not null`, `effective_from timestamptz not null`, `effective_to timestamptz null`, `status varchar(64) not null`, `version bigint not null default 0`, timestamps. PK; FKs RESTRICT; role code allowlist R1 `DOCTOR`, `TECHNICIAN`, `LAB_APPROVER`, `RADIOLOGIST`, `CARE_COORDINATOR`; valid interval; status `ACTIVE/REVOKED/EXPIRED`; no duplicate equivalent active interval by exclusion/transaction. Index practitioner/time/status, department/role/time.

## Patient tables

### `patient`

**Owner / tranche / purpose:** `patient` / R1 / patient identity nội bộ, không dùng national identifier làm PK.

| Column | PostgreSQL type | Null/default | Contract |
|---|---|---|---|
| `id` | `uuid` | not null | UUIDv7 PK |
| `full_name` | `varchar(200)` | not null | nonblank |
| `date_of_birth` | `date` | not null | not future |
| `phone` | `varchar(32)` | null | normalized display/contact, không unique |
| `email` | `varchar(320)` | null | optional patient contact, account email vẫn canonical login |
| `declared_gender` | `varchar(64)` | null | declared value enum/policy |
| `address` | `varchar(1000)` | null | sensitive |
| `emergency_contact` | `jsonb` | null | schema versioned object, sensitive |
| `version` | `bigint` | not null default 0 | optimistic lock |
| `created_at` | `timestamptz` | not null | UTC |
| `updated_at` | `timestamptz` | not null | UTC |

Constraints: PK; name/date checks; no unique phone/email. Index normalized search projection handled application/search index later; base indexes date_of_birth and phone only when query evidence exists.

### `patient_duplicate_candidate`

Columns: `id uuid`, `source_patient_id uuid`, `candidate_patient_id uuid`, `ordered_patient_low_id/high_id uuid` generated/application materialized, `match_reasons jsonb`, `score numeric(5,4)`, `status varchar(64)`, reviewer account UUID nullable, reviewed_at/reason nullable, created_at, version. All identity/reason/score/status/create fields not null. PK/FKs RESTRICT; source != candidate; score 0..1; low < high; partial unique `(low,high) where status='PENDING'`; status `PENDING/CONFIRMED/REJECTED/ENTERED_IN_ERROR`; reviewer/time/reason required on terminal review. Index status/created, source, candidate.

### `patient_account_link`

Columns: `id uuid`, `account_id uuid`, `patient_id uuid`, `relationship varchar(64)`, `verification_tier varchar(64)`, `permission_scope jsonb`, `valid_from timestamptz`, `valid_to timestamptz null`, `status varchar(64)`, `revoked_at timestamptz null`, `revoke_reason varchar(500) null`, `version bigint`, timestamps. PK/FKs RESTRICT; valid range; tier `PENDING/IDENTITY_VERIFIED/REPRESENTATION_VERIFIED`; status `ACTIVE/REVOKED/EXPIRED`; permission_scope schema-versioned and deny by default; no duplicate active equivalent link via partial unique/exclusion. Index account/status/time, patient/status/time.

### `patient_identifier`

Columns: `id uuid`, `patient_id uuid`, `identifier_type varchar(64)`, `issuer varchar(128)`, `jurisdiction varchar(64)`, `protected_value varchar(512)`, `comparison_token varchar(128)`, `display_suffix varchar(16)`, `status varchar(64)`, `verification_source varchar(64)`, collected_by_account UUID nullable, collected/verified/effective/revoked times, evidence_reference varchar(256) nullable, version bigint. Required: id/patient/type/issuer/jurisdiction/protected value/comparison token/status/source/collected/effective_from/version. PK/FKs RESTRICT; status allowlist `SELF_DECLARED/STAFF_RECORDED/MANUALLY_VERIFIED/ENTERED_IN_ERROR/REVOKED`; verified_at only for manually verified; revoked_at for revoked; partial unique `(identifier_type,issuer,comparison_token)` for active non-error status. Index patient/status, comparison token/status, verified/revoked time. Full value encrypted/tokenized; logs/UI only suffix.

`electronic_identity_link` không thuộc R1; chỉ migrate sau `IDN-02` và ADR-0008 approval.

## Trace

| Story | Decisions | ADR | Scenarios |
|---|---|---|---|
| `R1-03` | `CAT-01` | ADR-0001/0004 | catalog constraints/tests được bổ sung khi story implementation bắt đầu |
| `R1-04` | `DEP-05`, `IDN-01` | ADR-0004/0008 qualification | `SC-R1-PAT-01` |

Related: [[../22-backlog-mvp|Backlog]], [[README|Schema conventions]].
