---
aliases:
  - Scheduling payment schema R1
artifact_type: r1-schema-contract
status: ACCEPTED
module_owners:
  - scheduling
  - billing-payment
  - platform-audit
---
# Scheduling và payment deposit — R1

## `appointment_slot`

**Owner / tranche / purpose:** `scheduling` / R1 / capacity theo PractitionerRole/Department/Room/Service.

Columns: `id uuid`, practitioner_role/department/room/service UUIDs, `session varchar(64)`, `start_at/end_at timestamptz`, `capacity integer`, `status varchar(64)`, `version bigint`, timestamps. All not null. PK/FKs RESTRICT; capacity > 0; end > start; session `MORNING/AFTERNOON`; status `ACTIVE/CANCELLED/REPLACED`; same role cannot overlap active slots via exclusion constraint on `[start,end)`; room overlap disallowed by equivalent exclusion; max 4/day/2 session uses transaction locking PractitionerRole/day advisory/guard row and Asia/Ho_Chi_Minh service date. Index service/start/status, role/start, department/start.

## `slot_hold`

Columns: `id uuid`, slot/patient UUIDs, `expires_at timestamptz`, `deposit_amount numeric(19,2)`, `currency char(3)`, `status varchar(64)`, `version bigint`, timestamps. PK/FKs; currency VND; amount >=0; expires > created; status enum. Partial index active expiry; slot/status index. Capacity counts ACTIVE nonexpired holds + CONFIRMED/FULFILLED appointments under slot row lock.

HTTP/API retry uses `platform-audit.idempotency_record` as source of truth. Legacy `slot_hold.idempotency_scope`, `slot_hold.idempotency_key`, and `slot_hold.request_hash` are nullable residue from `V5`, unused after `V13`, and must only be removed by a compatibility-checked forward migration; new code must not use them.

## `payment_intent`

Columns: `id uuid`, `slot_hold_id uuid`, `provider varchar(64)`, `provider_reference varchar(128) null`, `amount numeric(19,2)`, `currency char(3)`, `status varchar(64)`, `reconciliation_reason varchar(256) null`, `version bigint`, timestamps. PK/FK; unique slot_hold; partial unique provider/reference non-null; amount >=0/currency VND; status check; reconciliation reason required for RECONCILIATION_REQUIRED. Index status/updated, provider/reference.

## `appointment`

Target contract columns: `id uuid`, patient/slot_hold UUIDs, `rescheduled_from_id/rescheduled_to_id uuid null`, `status varchar(64)`, `version bigint`, `created_at/updated_at timestamptz`. PK/FKs RESTRICT including self-FKs; unique slot_hold; partial unique from/to non-null; no self lineage; reciprocal lineage and same Patient enforced command transaction; status check. Index patient/status/time, slot/status. Reservation-consuming states CONFIRMED/FULFILLED.

Current `V13__scheduling_r1_05_completion.sql` provides only staging schema: patient, optional slot hold, slot, status, version and timestamps. It is used by capacity counting but has no booking/confirmation/reschedule command path yet; add target lineage/uniqueness constraints only with R1-06/R1-07 implementation through forward migration.

## `webhook_inbox`

**Owner / tranche / purpose:** `platform-audit` / R1 / immutable provider event evidence và processing state.

| Column | PostgreSQL type | Null/default | Contract |
|---|---|---|---|
| `id` | `uuid` | not null | UUIDv7 PK |
| `provider` | `varchar(64)` | not null | adapter ID |
| `event_id` | `varchar(128)` | not null | provider dedup ID |
| `event_type` | `varchar(128)` | not null | normalized event type |
| `provider_transaction_id` | `varchar(128)` | null | capture identity |
| `signature_status` | `varchar(64)` | not null | VALID/INVALID/NOT_VERIFIED |
| `payload_hash` | `varchar(128)` | not null | digest of exact received bytes |
| `payload` | `jsonb` | not null | encrypted/redacted retention policy; never trusted directly downstream |
| `provider_occurred_at` | `timestamptz` | null | typed signed business time |
| `received_at` | `timestamptz` | not null | server receive time |
| `provider_time_trust` | `varchar(64)` | not null | trust enum |
| `amount` | `numeric(19,2)` | null | normalized signed amount |
| `currency` | `char(3)` | null | VND when amount set |
| `status` | `varchar(64)` | not null | `RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED`, `DEAD_LETTER` |
| `processed_at` | `timestamptz` | null | terminal processing time |
| `error_code` | `varchar(128)` | null | redacted stable code |
| `attempts` | `integer` | not null default 0 | nonnegative |
| `next_attempt_at` | `timestamptz` | null | retry schedule |
| `correlation_id` | `varchar(128)` | not null | trace |
| `version` | `bigint` | not null default 0 | worker claim/update |

Constraints: unique `(provider,event_id)`; signature/time/status checks; trusted requires VALID + non-null occurred time + within ±5m of received; amount/currency pair; processed timestamp terminal; attempts >=0. Index status/next attempt, provider transaction, received time, correlation.

## `payment`

**Owner / tranche / purpose:** `billing-payment` / R1 / immutable capture movement.

Columns: `id uuid`, payment_intent_id nullable, provider/transaction ID, amount/currency, status, `provider_occurred_at timestamptz null`, `provider_time_trust varchar(64)`, `webhook_inbox_id uuid null`, captured_at timestamptz, created_at. PK/FKs RESTRICT; unique `(provider,transaction_id)`; amount >0; currency VND; CAPTURED requires captured_at, trusted online capture requires inbox/time; cash provider may use server occurrence with explicit source policy. No update of amount/transaction/occurred time after insert. Index intent, captured time/status.

## `deposit_allocation`

**Owner / tranche / purpose:** `billing-payment` / R1 / immutable allocation of captured deposit to Appointment.

Columns: `id uuid`, payment/appointment UUIDs, `amount numeric(19,2)`, `currency char(3)`, `allocation_type varchar(64)`, `source_allocation_id uuid null`, `status varchar(64)`, `created_at timestamptz`, `correlation_id varchar(128)`. PK/FKs RESTRICT/self; amount >0/VND; type `ORIGINAL/TRANSFER_IN`; status `ACTIVE/TRANSFERRED/REFUND_PENDING/REFUNDED/ENTERED_IN_ERROR`; source required only transfer in; active sum per appointment equals required deposit enforced locked transaction; movement rows immutable, status transition only. Index appointment/status, payment/status, source.

## `deposit_transfer`

Columns: `id uuid`, old/new appointment UUIDs, source/target allocation UUIDs, `amount numeric(19,2)`, currency, `difference_amount numeric(19,2)`, `difference_disposition varchar(64)`, actor/reason/correlation, `created_at`. All not null except reason only optional outside 24h; disposition `NONE/ADDITIONAL_CAPTURE/REFUND_PENDING`; amount >0, difference >=0, old != new; unique old appointment (one replacement); target source lineage matches source allocation and appointments enforced transaction. Immutable. Index new appointment, correlation.

HTTP/API replay remains owned by `platform-audit.idempotency_record`; do not duplicate `idempotency_scope/key/request_hash` in this table. The business unique key on old appointment remains required.

## States and transitions

- Payment capture never changes into refund movement.
- Reschedule commit requires target Appointment, reciprocal lineage, target active deposit allocation and transfer row in same transaction.
- Additional capture must be CAPTURED before reschedule commit.
- Lower target deposit leaves excess source funding marked REFUND_PENDING; external refund is outbox/reconciliation after commit.
- Any internal failure before commit rolls back; retry same key/payload returns same transfer/new Appointment.

## Trace

| Story | Decisions | ADR | Scenarios |
|---|---|---|---|
| `R1-05` | `APT-01..03`, `DATA-05` | ADR-0003/0006 | `SC-R1-BOOK-04` |
| `R1-06` | `PAY-02..06` | ADR-0006/0011 | `SC-R1-PAY-01..02`, `SC-R1-BOOK-01..03` |
| `R1-07` | `APT-04`, `APT-06`, `PAY-07` | ADR-0005/0011 | `SC-R1-RESCHEDULE-01..02` |

Related: [[../05-thanh-toan-va-doanh-thu|Payment]], [[../22-backlog-mvp|Backlog]], [[README|Schema conventions]].
