---
aliases:
  - Schema vật lý MVP
  - Physical schema contract
artifact_type: physical-schema
status: ACCEPTED
---
# Schema vật lý MVP

<!-- obsidian-nav:start -->
[[20-so-quyet-dinh-kien-truc|Phần trước]] · [[docs|Mục lục]] · [[22-backlog-mvp|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## Phạm vi và nguồn chuẩn

Đây là index canonical cho physical contract. DDL/JPA phải được sinh từ contract R1 chi tiết, không từ ERD logic hoặc bảng tóm tắt.

- [[schema/README|Quy ước và enum registry R1]].
- [[schema/identity-access-audit-r1|Identity, access và audit R1]].
- [[schema/catalog-patient-r1|Catalog và Patient R1]].
- [[schema/scheduling-payment-r1|Scheduling và payment deposit R1]].
- [[schema/reception-clinical-r1|Reception và clinical R1]].
- [[schema/billing-reliability-notification-r1|Billing, reliability và notification R1]].

ERD logic: [[11-mo-hinh-du-lieu|Mô hình dữ liệu]]. Decision register: [[14-gia-dinh-cau-hoi-va-dinh-huong#22.1. Quyết định đã chốt|quyết định canonical]]. ADR: [[adr/README|ADR index]].

## Quy ước PostgreSQL/JPA

Quy ước đầy đủ và enum registry: [[schema/README|R1 physical schema contracts]].

## Identity, RBAC và audit

Contract: [[schema/identity-access-audit-r1|Identity/access/audit R1]].

## Patient và dependent

Contract R1: [[schema/catalog-patient-r1|Catalog/Patient R1]]. Dependent nâng cao nằm MVP-LATER.

## Scheduling và reception queue

Contracts: [[schema/scheduling-payment-r1|Scheduling/payment R1]] và [[schema/reception-clinical-r1|Reception/clinical R1]].

## Diagnostics

Diagnostics nằm MVP-LATER; chưa có active R1 migration.

## Billing và payment

Contracts: [[schema/scheduling-payment-r1|Payment/deposit R1]] và [[schema/billing-reliability-notification-r1|Billing R1]].

## Tranche classification

| Tranche | Contract |
|---|---|
| `R1` | Có column/type/null/default/FK/check/index/state/trace đầy đủ; phải migrate trước feature story tương ứng |
| `MVP-LATER` | Design baseline; chỉ chi tiết hóa/migrate khi tranche đạt DoR |
| `REGULATORY-PRODUCTION` | Chỉ migrate/activate sau legal/clinical/security gate và ADR liên quan ACCEPTED |
| `DEFERRED` | Không migrate trong MVP ngoại trú |

## Trạng thái triển khai schema

Flyway là nguồn chuẩn cho bảng đã tồn tại trong runtime. Contract R1 bên dưới là đích đã ACCEPTED cho feature story tương ứng, **không đồng nghĩa mọi bảng đã migrate**.

| Trạng thái | Count | Ý nghĩa |
|---|---:|---|
| Migrated và có code path | 24 | DDL trong `V1`–`V14`; repository/service/controller hoặc integration test đang dùng. |
| Migrated nhưng chưa hoàn chỉnh | 2 | `appointment` là staging schema cho booking/reschedule; `outbox_event` chờ R1-14 dispatcher. |
| Target R1 forward-only | 21 | Contract đã ACCEPTED, nhưng chưa có Flyway migration. Chỉ tạo cùng feature story, owner code và acceptance test. |
| Tổng target R1 | 47 | 26 bảng hiện có + 21 bảng forward-only. |

### Migrated runtime schema — 26 tables

| Module owner | Migration | Tables |
|---|---|---|
| `platform-audit` | `V1` | `audit_event`, `idempotency_record`, `outbox_event` *(dormant; R1-14)* |
| `identity-access` | `V2` | `user_account`, `password_credential`, `authentication_challenge`, `account_token`, `account_session`, `role`, `permission`, `role_permission`, `account_role_assignment`, `break_glass_grant` |
| `catalog` | `V3` | `department`, `room`, `service`, `service_price`, `practitioner`, `practitioner_role` |
| `patient` | `V4` | `patient`, `patient_duplicate_candidate`, `patient_account_link`, `patient_identifier` |
| `scheduling` | `V5`, `V13` | `appointment_slot`, `slot_hold`, `appointment` *(dormant/incomplete booking lifecycle)* |

`V0` không tạo domain table. `V6`–`V12` và `V14` là forward integrity/remediation/seed migrations, không tạo table.

### Target R1 forward-only — 21 tables

| Module owner | Tables |
|---|---|
| `platform-audit` | `webhook_inbox` |
| `scheduling` | `payment_intent` |
| `reception-queue` | `check_in`, `visit`, `encounter`, `encounter_participant`, `queue_policy`, `queue_entry`, `queue_adjustment` |
| `clinical-care` | `clinical_note`, `clinical_note_version`, `diagnosis`, `diagnosis_version`, `service_delivery` |
| `billing-payment` | `payment`, `deposit_allocation`, `deposit_transfer`, `billing_account`, `charge_item`, `payment_allocation` |
| `notification` | `notification_delivery` |
| `diagnostics` | Package boundary only; không active table trong R1 |

`ServiceDelivery` do `clinical-care` sở hữu. `billing-payment` consume public event/API và không dùng JPA entity ClinicalCare.

`outbox_event` không được gộp vào `audit_event`: audit là evidence append-only, còn outbox là worker state mutable. `appointment` không được gộp vào `slot_hold`: hold hết hạn và nhả capacity, appointment là reservation bền vững cho payment/confirmation/reschedule.

### Active R1 contract inventory

Bảng sau là ownership/contract inventory cho toàn R1; xem trạng thái migrate ở hai bảng trên.

| Module owner | Tables |
|---|---|
| `identity-access` | `user_account`, `password_credential`, `authentication_challenge`, `account_token`, `account_session`, `role`, `permission`, `role_permission`, `account_role_assignment`, `break_glass_grant` |
| `platform-audit` | `audit_event`, `idempotency_record`, `webhook_inbox`, `outbox_event` |
| `catalog` | `department`, `room`, `service`, `service_price`, `practitioner`, `practitioner_role` |
| `patient` | `patient`, `patient_duplicate_candidate`, `patient_account_link`, `patient_identifier` |
| `scheduling` | `appointment_slot`, `slot_hold`, `payment_intent`, `appointment` |
| `reception-queue` | `check_in`, `visit`, `encounter`, `encounter_participant`, `queue_policy`, `queue_entry`, `queue_adjustment` |
| `clinical-care` | `clinical_note`, `clinical_note_version`, `diagnosis`, `diagnosis_version`, `service_delivery` |
| `billing-payment` | `payment`, `deposit_allocation`, `deposit_transfer`, `billing_account`, `charge_item`, `payment_allocation` |
| `notification` | `notification_delivery` |
| `diagnostics` | Package boundary only; không active table trong R1 |

### Outside active R1 migration

- `MVP-LATER`: `dependent_verification`, `verification_evidence`, `health_baseline_*`, `clinical_attachment*`, `prescription*`, Episode/CareTeam/Referral, Order/Result, refund/reversal UI/workflow tables.
- `REGULATORY-PRODUCTION`: `electronic_identity_link`, `electronic_attestation`, legacy paper conversion tables.
- `DEFERRED`: inpatient/bed, merge/split và integration tables sau MVP.

Prescription từng được liệt kê R1 nhưng backlog `R1-10` chỉ cam kết ClinicalNote/Diagnosis. Vì vậy `prescription`/`prescription_item` chuyển `MVP-LATER` đến khi có story/scenario/DoR riêng.

## Cross-table invariants

| Invariant | Enforcement |
|---|---|
| Authentication token/session không replay | Unique keyed hash + purpose/status/expiry + locked transition |
| Account reset/disable revoke access | Command locks account, revokes active credential/session/token, writes audit/outbox cùng transaction |
| Slot capacity không oversell | Row lock AppointmentSlot + active hold/reservation count + optimistic version |
| Provider time trusted | Signed payload + typed `provider_occurred_at` + trust outcome/check; untrusted event reconciliation only |
| One Appointment/Visit per CheckIn | Unique appointment/visit trên CheckIn |
| One active QueueEntry/Encounter | Partial unique active statuses |
| Clinical FINALIZED immutable | No update repository path + status/digest/finalizer checks + amendment version |
| One original ChargeItem/ServiceDelivery | Partial unique original + same Visit transaction check |
| Deposit transfer preserves lineage | Immutable source/target allocations + transfer row + reciprocal Appointment transaction |
| Allocation không vượt capture | Lock Payment + aggregate sum check |
| Command/webhook không trùng | Unique idempotency/inbox identity + request/payload hash |
| Audit/outbox same commit | Application transaction; integration test per command |

## Migration ordering Phase 1

1. Reliability primitives required by first command: idempotency/outbox/audit.
2. Identity/access/authentication/session.
3. Catalog + PractitionerRole.
4. Patient + identifier.
5. Scheduling + PaymentIntent + webhook inbox + payment/deposit allocation.
6. Appointment/reschedule transfer.
7. Reception queue + Visit/Encounter.
8. ClinicalNote/Diagnosis/ServiceDelivery technical finalization.
9. BillingAccount/ChargeItem/PaymentAllocation.
10. Notification delivery/jobs.

Mỗi migration phải smoke-test DB sạch và upgrade path. Flyway/JPA/OpenAPI/test trace cùng change. Không tạo một migration chứa toàn bộ R1 nếu story owner/acceptance chưa sẵn sàng.

## Contract change rule

- Thay type/nullability/constraint/state phải cập nhật owner schema file, Decision/ADR và scenario trước DDL.
- Sau production data, không rewrite applied migration; thêm forward migration và compatibility plan.
- Schema file không thay legal evidence. `SIGN-01`, `IDN-02`, `REG-*` và operational gates vẫn độc lập.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[11-mo-hinh-du-lieu|ERD logic]]
- [[20-so-quyet-dinh-kien-truc|Kiến trúc]]
- [[22-backlog-mvp|Backlog]]
- [[adr/README|ADR]]
<!-- related-links:end -->
