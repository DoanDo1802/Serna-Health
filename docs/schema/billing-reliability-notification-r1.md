---
aliases:
  - Billing reliability notification schema R1
artifact_type: r1-schema-contract
status: ACCEPTED
module_owners:
  - billing-payment
  - platform-audit
  - notification
---
# Billing, reliability và notification — R1

## Billing tables

### `billing_account`

**Owner / tranche / purpose:** `billing-payment` / R1 / one ledger aggregate per Visit.

Columns: `id uuid`, `visit_id uuid`, `status varchar(64)`, `currency char(3) default 'VND'`, `balance_due numeric(19,2)`, `version bigint default 0`, opened/closed/reopened timestamps nullable as state requires, `close_reason/reopen_reason varchar(500) null`, timestamps. PK/FK Visit RESTRICT; unique visit; currency VND; status check; balance is cached/derived and must reconcile with ledger in locked transaction; close/reopen timestamp/reason checks. Index status/updated, visit.

### `charge_item`

Columns: `id uuid`, account/service_delivery UUIDs, `replaces_id uuid null`, quantity `numeric(12,3)`, unit_price/discount/gross/net `numeric(19,2)`, currency, `status varchar(64)`, created_at. PK/FKs RESTRICT; partial unique original service_delivery where replaces null; quantity >0; amounts >=0; gross = quantity × unit price under documented rounding; net = gross - discount; currency VND; replacement same delivery/account; immutable financial fields. Index account/status, delivery, replaces.

### `payment_allocation`

Columns: `id uuid`, payment/account UUIDs, `amount numeric(19,2)`, currency, `allocation_type varchar(64)`, `created_at timestamptz`, correlation ID. PK/FKs; amount >0/VND; type `DEPOSIT_APPLIED/CASH_PAYMENT/ACCOUNT_ALLOCATION`; unique semantic key enforced source command/idempotency; total allocations <= captured amount under Payment lock. Immutable. Index payment, account/time.

`payment`, `deposit_allocation`, `deposit_transfer` nằm trong [[scheduling-payment-r1|Scheduling/payment contract]] vì booking/reschedule trace cần cùng view, nhưng owner vẫn `billing-payment`.

## `idempotency_record`

**Owner / tranche / purpose:** `platform-audit` / R1 / command replay contract.

Columns: `id uuid`, `principal_scope varchar(128)`, `operation varchar(128)`, `idempotency_key varchar(128)`, `request_hash varchar(128)`, `status varchar(64)`, response type `varchar(128)`/response ID `uuid null`, response status integer nullable, error code varchar(128) nullable, `created_at/updated_at/expires_at timestamptz`, `version bigint`. PK; unique `(principal_scope,operation,idempotency_key)`; status `IN_PROGRESS/SUCCEEDED/FAILED`; same key different hash conflict; success response identity required; expiry > create. Index expiry/status, response identity.

## `outbox_event`

**Owner / tranche / purpose:** `platform-audit` / R1 / transactional domain event delivery.

Columns: `id uuid`, aggregate type/id, event type varchar(128), `payload_schema_version varchar(32)`, `payload jsonb`, `occurred_at timestamptz`, published_at nullable, `attempts integer default 0`, `status varchar(64)`, next_attempt_at/error_code nullable, correlation ID, version bigint. PK; status `PENDING/PROCESSING/PUBLISHED/FAILED/DEAD_LETTER`; attempts >=0; published_at iff PUBLISHED; payload schema required. Partial index pending `(status,next_attempt_at,occurred_at)`; aggregate history; correlation.

## `notification_delivery`

**Owner / tranche / purpose:** `notification` / R1 / delivery attempt và dedup, không chứa full clinical payload.

Columns: `id uuid`, source resource type/id, recipient account UUID, `channel varchar(64)`, template code/version, `locale varchar(16)`, `dedup_key varchar(128)`, `status varchar(64)`, scheduled/sent timestamps, attempts integer default 0, next_attempt/error_code nullable, correlation ID, version bigint, created_at. PK/FKs; unique `(recipient_account_id,channel,dedup_key)`; channel R1 `EMAIL`; status `PENDING/PROCESSING/SENT/FAILED/CANCELLED/DEAD_LETTER`; attempts >=0; state timestamp checks. Index status/next attempt, recipient/time, resource.

Template variables are allowlisted and resolved at send time under minimum-data policy. No password, OTP, token or clinical payload in generic notification table. Authentication challenge delivery references challenge ID through private command, not reusable token value in DB payload.

## Reliability states

- Worker claims record using optimistic/row lock and increments attempts atomically.
- Retry uses bounded exponential backoff with configurable max; exhausted event enters DEAD_LETTER and emits alert/audit.
- Domain transaction writes outbox before commit; external email/refund/provider side effect never runs inside domain transaction.
- Inbox contract nằm tại [[scheduling-payment-r1|Scheduling/payment contract]], mục `webhook_inbox`.

## Trace

| Story | Decisions | ADR | Scenarios |
|---|---|---|---|
| `R1-02` | `SEC-05`, `REL-01..02` | ADR-0003/0004 | `SC-R1-SEC-01`, `SC-R1-REL-01` |
| `R1-11..13` | `BILL-01..09` | ADR-0006 | `SC-R1-BILL-01..02` |
| `R1-14` | `REL-01`, NFR observability | ADR-0003 | notification retry scenario required before R1-14 coding |

Related: [[../18-billing-account-va-charge-item|Billing]], [[../22-backlog-mvp|Backlog]], [[README|Schema conventions]].
