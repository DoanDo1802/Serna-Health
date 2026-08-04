---
aliases:
  - R1 physical schema contracts
artifact_type: schema-contract-index
status: ACCEPTED
---
# R1 physical schema contracts

[[../21-schema-vat-ly-mvp|Schema vật lý MVP]] là index canonical. Các file này khóa DDL/JPA contract Release 1 trước migration.

## Contract format

Mỗi bảng dùng các phần bắt buộc:

1. `Owner / tranche / purpose`.
2. Bảng cột: `Column`, `PostgreSQL type`, `Null/default`, `Contract`.
3. `Keys and constraints` với tên `pk_`, `fk_`, `uk_`, `ck_`.
4. `Indexes` với tên `ix_` và query/invariant được phục vụ.
5. `States and transitions` nếu có status.
6. `Trace` theo Story → Decision → ADR → Scenario.

## Global conventions

- PK/FK `uuid`; UUIDv7 do application sinh trước persist.
- Table/column số ít `lower_snake_case`; table tên số ít.
- Instant `timestamptz`, UTC; date thuần `date`.
- Money `numeric(19,2)`; currency `char(3)` và R1 check `VND`.
- Code/status `varchar(64)`; text có max length rõ hoặc `text`.
- Mutable aggregate có `version bigint not null default 0` và JPA `@Version`.
- FK `ON DELETE RESTRICT`; mọi FK dùng join có index.
- Clinical, financial, auth security evidence và audit không hard/soft delete. Dùng revoke, expiry, amendment, reversal hoặc entered-in-error.
- `created_at`/`updated_at` do application set từ UTC clock; DB default chỉ dùng khi contract ghi rõ.
- Secret/token/OTP/session values chỉ lưu keyed hash/digest; không log hoặc trả qua API.
- JSONB phải có schema/version hoặc contract field; không dùng JSON để né typed invariant.

## Enum registry R1

Enum lưu `varchar(64)` + named check constraint; Java enum phải dùng string mapping.

| Domain | Values |
|---|---|
| UserAccount status | `PENDING_VERIFICATION`, `ACTIVE`, `TEMPORARILY_LOCKED`, `DISABLED`, `PERMANENTLY_LOCKED` |
| Credential status | `ACTIVE`, `REVOKED`, `SUPERSEDED` |
| Challenge/token status | `PENDING`, `CONSUMED`, `EXPIRED`, `REVOKED`, `LOCKED` |
| Session status | `ACTIVE`, `EXPIRED`, `REVOKED` |
| SlotHold | `ACTIVE`, `CONSUMED`, `EXPIRED`, `CANCELLED` |
| PaymentIntent | `PENDING`, `SUCCEEDED`, `FAILED`, `EXPIRED`, `RECONCILIATION_REQUIRED`, `REFUND_PENDING`, `REFUNDED` |
| Appointment | `CONFIRMED`, `FULFILLED`, `CANCELLED`, `RESCHEDULED`, `NO_SHOW`, `ENTERED_IN_ERROR` |
| Webhook signature | `VALID`, `INVALID`, `NOT_VERIFIED` |
| Provider time trust | `TRUSTED`, `MISSING`, `INVALID_FORMAT`, `UNTRUSTED_SIGNATURE`, `OUT_OF_RANGE` |
| QueueEntry | `WAITING`, `CALLED`, `IN_SERVICE`, `DEFERRED`, `COMPLETED`, `CANCELLED`, `ENTERED_IN_ERROR` |
| Clinical R1 version | `DRAFT`, `FINALIZED`, `ENTERED_IN_ERROR` |
| ServiceDelivery | `PLANNED`, `PERFORMED`, `CANCELLED`, `ENTERED_IN_ERROR` |
| BillingAccount | `OPEN`, `ON_HOLD`, `CLOSED`, `VOID` |
| ChargeItem | `BILLABLE`, `BILLED`, `REVERSED`, `ENTERED_IN_ERROR` |
| Payment | `CAPTURED`, `VOIDED`, `ENTERED_IN_ERROR` |
| Inbox/outbox/notification | Resource-specific values trong owner file |

## Ownership

| Contract | Table owner |
|---|---|
| [[identity-access-audit-r1|Identity/access/audit]] | `identity-access`, `platform-audit` |
| [[catalog-patient-r1|Catalog/patient]] | `catalog`, `patient` |
| [[scheduling-payment-r1|Scheduling/payment deposit]] | `scheduling`, `billing-payment`, `platform-audit` |
| [[reception-clinical-r1|Reception/clinical]] | `reception-queue`, `clinical-care` |
| [[billing-reliability-notification-r1|Billing/reliability/notification]] | `billing-payment`, `platform-audit`, `notification` |

Một table chỉ có một owner. Cross-module FK không cho phép dùng entity association; module giữ UUID/value contract và gọi public API/event.

## Excluded from active R1 migration

`electronic_identity_link`, `electronic_attestation`, `health_baseline_*`, `clinical_attachment*`, `prescription*`, Episode/CareTeam/Referral, diagnostics Result/Order, refund/reversal và legacy conversion. Các resource này chỉ migrate khi tranche/gate tương ứng đạt DoR.
