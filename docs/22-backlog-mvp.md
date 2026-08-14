---
aliases:
  - Backlog MVP
artifact_type: delivery-backlog
status: ACCEPTED
---
# Backlog MVP

<!-- obsidian-nav:start -->
[[21-schema-vat-ly-mvp|Phần trước]] · [[docs|Mục lục]] · [[23-ma-tran-yeu-cau-tt13-2025|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## Quy ước

- Priority: `P0`, `P1`, `P2`.
- DoR: `READY`, `BLOCKED`, `DEFERRED`.
- Acceptance baseline: [[13-ke-hoach-va-nghiem-thu-mvp#20. Tiêu chí nghiệm thu MVP|MVP acceptance]].
- Mỗi story trace đến Decision/ADR, schema và scenario.

## Release 1 — Thin operational slice

| Story | Outcome | Priority | Dependency | Decisions/ADR | Schema | DoR |
|---|---|---:|---|---|---|---|
| `R1-01` | Bootstrap layered monolith, DB/migration/test boundary | P0 | Phase 0 GO | ARCH/DATA, ADR-0001/2/9 | Conventions | READY |
| `R1-02` | Email/password + email OTP, session, role/permission và append-only audit | P0 | R1-01 | AUTH/IAM/SEC, ADR-0004/0010 | [[schema/identity-access-audit-r1|Identity/access/audit]] | READY |
| `R1-03` | Department/Room/Service/Price/PractitionerRole catalog | P0 | R1-01 | CAT-01 | Catalog | READY |
| `R1-04` | Patient chính chủ + PatientIdentifier thu thập CCCD/hộ chiếu + duplicate-candidate review workflow | P0 | R1-02 | DEP-05, IDN-01 | Patient + identifier + duplicate candidate | READY |
| `R1-04E` | Electronic identity provider link và electronic verification | P0 | R1-04, IDN-02 | TT13-1.3, ADR-0008 | ElectronicIdentityLink | BLOCKED |
| `R1-05` | AppointmentSlot và capacity-safe SlotHold | P0 | R1-03/04 | SHIFT, DATA-05, REL | Scheduling | READY |
| `R1-06` | Mock PaymentIntent success/failure/late/untrusted event | P0 | R1-05 | PAY-02..06, ADR-0006/0011 | [[schema/scheduling-payment-r1|PaymentIntent/Inbox/Payment]] | READY |
| `R1-07` | Appointment confirmation, reschedule lineage và atomic deposit transfer | P0 | R1-06 | APT-03/04/06, PAY-07, ADR-0005/0011 | [[schema/scheduling-payment-r1|Appointment/deposit]] | READY |
| `R1-08` | Staff CheckIn idempotent tạo Visit/Encounter/Queue | P0 | R1-07 | CHECKIN-01 | Reception | READY |
| `R1-09` | Queue call/defer/service/adjust flow | P0 | R1-08 | QUEUE-06/07 | Queue | READY |
| `R1-10` | Encounter + ClinicalNote/Diagnosis DRAFT→FINALIZED; technical immutability only | P0 | R1-08, R1-02 | CLIN-01/02/04, ADR-0007/0012 | [[schema/reception-clinical-r1|Clinical technical versions]] | READY |
| `R1-10L` | Lawful signing/confirmation for clinical versions | P0 | R1-10, REG-02, SIGN-01 | TT13-3, ADR-0008 | Attestation | BLOCKED |
| `R1-11` | ServiceDelivery tạo ChargeItem đúng một lần | P0 | R1-10, R1-03 | BILL-06/07 | Billing | READY |
| `R1-12` | Cash/mock Payment + Allocation + ledger | P0 | R1-11 | BILL ledger | Billing/payment | READY |
| `R1-13` | Complete Encounter/Visit/BillingAccount với guards | P0 | R1-09..12 | VISIT-01/02, BILL-08/09 | Reception/billing | READY |
| `R1-14` | Outbox notification tối thiểu + observability | P1 | R1-02, R1-07/08/13 | REL/NFR | Reliability | READY |
| `R1-15` | Security/load/restore/UAT evide
nce theo workload baseline | P0 | R1-01..14 | NFR-06..11, DEL-02 | Cross-cutting | READY |

API operation inventory và OpenAPI trace: [[25-api-inventory-r1|API inventory Release 1]].

## Given/When/Then scenarios Release 1

### `SC-R1-AUTH-01` — Email/password và anti-enumeration

- **Given** email normalized chưa có account và password hợp policy.
- **When** đăng ký, verify email rồi authenticate hợp lệ.
- **Then** một UserAccount ACTIVE, một PasswordCredential ACTIVE và opaque session mới được tạo; cookie Secure/HttpOnly/SameSite=Lax, session ID rotated, audit không chứa credential/token.
- **When** đăng ký/login/recovery với email không tồn tại hoặc password sai.
- **Then** response public generic, không tiết lộ account existence; failure/rate-limit evidence được redacted và không tạo session.

### `SC-R1-AUTH-02` — OTP expiry, rate limit và replay

- **Given** email đã xác minh và challenge PENDING.
- **When** OTP đúng trong 10 phút, dưới 5 attempts.
- **Then** challenge CONSUMED đúng một lần và session được tạo; replay trả denial không side effect.
- **When** OTP hết hạn, bị revoke bởi mã mới, sai lần thứ 5, resend trước 60 giây hoặc vượt 5 lần phát/giờ theo target + source IP.
- **Then** request bị từ chối/rate-limited bằng response generic; không session/token mới; state/audit đúng contract.

### `SC-R1-AUTH-03` — Lockout, recovery và session revocation

- **Given** account ACTIVE có active sessions.
- **When** password sai lần thứ 5 liên tiếp.
- **Then** account TEMPORARILY_LOCKED 15 phút; login tiếp theo bị từ chối dù password đúng cho đến boundary.
- **When** one-time reset token hợp lệ trong 30 phút đổi password, hoặc account bị disable/email change.
- **Then** credential cũ superseded, token consumed/revoked và mọi active session bị revoke atomically; token/session replay bị từ chối.

### `SC-R1-PAT-01` — Suspected duplicate

- **Given** hồ sơ mới trùng tín hiệu phone/contact/name/date-of-birth với Patient hiện có nhưng không đủ deterministic match.
- **When** Receptionist tạo hồ sơ.
- **Then** Patient mới được tạo hoặc giữ theo policy; CCCD/hộ chiếu nếu có được lưu trong `patient_identifier` ở trạng thái `SELF_DECLARED`, `STAFF_RECORDED` hoặc `MANUALLY_VERIFIED`; một `patient_duplicate_candidate` PENDING chứa reasons/score; không auto-merge.
- **When** authorized reviewer CONFIRM/REJECT candidate.
- **Then** status, reviewer, reason và audit được ghi; merge Patient nằm ngoài Release 1 nên chỉ tạo follow-up, không đổi ID/lịch sử.

### `SC-R1-BOOK-01` — Booking thành công

- **Given** Slot còn capacity, Hold ACTIVE, mock intent amount/currency khớp và chưa hết hạn.
- **When** success event hợp lệ được xử lý.
- **Then** một Payment CAPTURED, Hold CONSUMED và một Appointment CONFIRMED được commit; outbox/audit cùng correlation ID.

### `SC-R1-BOOK-02` — Duplicate webhook

- **Given** event đã processed.
- **When** cùng provider/event ID hoặc command key/payload được gửi lại.
- **Then** trả cùng result; không có Payment/Appointment/outbox business event thứ hai.

### `SC-R1-BOOK-03` — Late success

- **Given** Hold expired hoặc reservation không còn dùng được.
- **When** success đến.
- **Then** không tạo Appointment/oversell; PaymentIntent RECONCILIATION_REQUIRED và refund/reconciliation event được ghi.

### `SC-R1-BOOK-04` — Capacity race

- **Given** một chỗ cuối và nhiều request đồng thời.
- **When** các transaction tạo Hold.
- **Then** đúng một reservation thành công; tổng active reservation không vượt capacity.

### `SC-R1-PAY-01` — Provider time tại expiry boundary

- **Given** signed mock event có amount/currency đúng, reservation hợp lệ và trusted `provider_occurred_at` trong clock-skew policy.
- **When** provider time trước `expires_at`.
- **Then** Payment/Appointment được tạo đúng một lần.
- **When** provider time bằng hoặc sau `expires_at` dù `received_at` trước/sau khác nhau.
- **Then** capture được giữ, không Appointment/oversell; PaymentIntent `RECONCILIATION_REQUIRED`.

### `SC-R1-PAY-02` — Untrusted provider event

- **Given** success event thiếu timestamp, parse sai offset, signature invalid/not verified hoặc timestamp ngoài ±5 phút quanh received time.
- **When** inbox xử lý event.
- **Then** không tạo Appointment; trust outcome typed được lưu; PaymentIntent reconciliation và audit/outbox failure path được ghi. Duplicate event không tạo evidence/movement business thứ hai.

### `SC-R1-RESCHEDULE-01` — Atomic equal-deposit transfer

- **Given** Appointment cũ CONFIRMED có active DepositAllocation và lịch mới cần cùng mức cọc.
- **When** authorized reschedule command chạy với idempotency key hợp lệ.
- **Then** Appointment mới CONFIRMED, lịch cũ RESCHEDULED, reciprocal lineage, target allocation và DepositTransfer commit cùng transaction; capture gốc không đổi. Retry trả cùng result.

### `SC-R1-RESCHEDULE-02` — Deposit difference và compensation

- **Given** cọc lịch mới cao hơn.
- **When** additional capture fail/timeout hoặc internal transaction fail.
- **Then** lịch/cọc cũ giữ nguyên; không partial lineage/transfer.
- **Given** cọc lịch mới thấp hơn.
- **When** reschedule commit.
- **Then** transfer đúng required amount; phần dư `REFUND_PENDING`/reconciliation qua outbox. External refund failure retry, không đảo lineage. Cùng key khác payload conflict.

### `SC-R1-CHECKIN-01` — Staff check-in

- **Given** Appointment CONFIRMED, actor có `checkin.execute`, trong cửa sổ.
- **When** command hợp lệ chạy.
- **Then** một CheckIn, Visit ARRIVED, Encounter PLANNED và QueueEntry WAITING được tạo; Appointment FULFILLED.

### `SC-R1-CHECKIN-02` — Unauthorized/late

- **Given** actor thiếu permission hoặc ngoài cửa sổ không reason.
- **When** CheckIn.
- **Then** từ chối, không side effect; audit outcome DENIED. Authorized exception với reason được ghi riêng.

### `SC-R1-QUEUE-01` — State guard

- **Given** QueueEntry WAITING.
- **When** transition trực tiếp COMPLETED hoặc hai entry active cùng Encounter được yêu cầu.
- **Then** domain từ chối; valid CALL→IN_SERVICE→COMPLETED phát event/audit.

### `SC-R1-CLIN-01` — FINALIZED technical version bất biến

- **Given** ClinicalNoteVersion hoặc DiagnosisVersion FINALIZED có finalizer/time/digest.
- **When** actor cố update payload.
- **Then** từ chối; amendment tạo DRAFT version mới có previous ID/reason, bản cũ không đổi.

### `SC-R1-CLIN-02` — Lawful-signing capability fail closed

- **Given** R1 technical deployment còn `SIGN-01` OPEN và không có ElectronicAttestation tranche.
- **When** client gọi action sign/publish hoặc UI/API cố trình bày FINALIZED là đã ký hợp pháp.
- **Then** capability không active/denied; không tạo SIGNED state hoặc attestation giả. Finalize vẫn hoạt động theo permission technical riêng.

### `SC-R1-BILL-01` — Charge idempotent và đúng Visit

- **Given** ServiceDelivery PERFORMED thuộc Encounter/Visit A và BillingAccount của Visit A.
- **When** event bị replay.
- **Then** chỉ một original ChargeItem; amount snapshot đúng ServicePrice/version và account thuộc cùng Visit.
- **When** command cố gắn delivery Visit A vào account Visit B.
- **Then** domain từ chối, không tạo ChargeItem, audit failure.

### `SC-R1-BILL-02` — Close guard

- **Given** Visit/Queue/Encounter terminal, delivery settled, no pending transaction, balance 0.
- **When** close account.
- **Then** CLOSED. Nếu một guard sai, account không đóng và trả blocker list.

### `SC-R1-SEC-01` — Default deny

- **Given** actor không có permission/context phù hợp.
- **When** đọc/sửa clinical hoặc approve financial request.
- **Then** 403/domain denial, không data leak, audit DENIED.

### `SC-R1-REL-01` — Idempotency key reuse khác payload

- **Given** key đã dùng với request hash A.
- **When** key dùng với hash B.
- **Then** conflict; không trả response cũ và không side effect mới.

## Traceability gate cho blocker đã đóng

| Story | Decision | ADR | Schema | Acceptance |
|---|---|---|---|---|
| `R1-02` | `AUTH-01..06`, `SEC-03..05`, `REL-01` | ADR-0003, ADR-0004, ADR-0010 | [[schema/identity-access-audit-r1|Identity/access/audit]], [[schema/billing-reliability-notification-r1|Reliability]] | `SC-R1-AUTH-01..03`, `SC-R1-SEC-01`, `SC-R1-REL-01` |
| `R1-06` | `PAY-02..06` | ADR-0006, ADR-0011 | [[schema/scheduling-payment-r1|Intent/inbox/payment]] | `SC-R1-BOOK-01..03`, `SC-R1-PAY-01..02` |
| `R1-07` | `APT-04/06`, `PAY-07` | ADR-0005, ADR-0011 | [[schema/scheduling-payment-r1|Appointment/deposit transfer]] | `SC-R1-RESCHEDULE-01..02` |
| `R1-10` | `CLIN-01/02/04` | ADR-0007, ADR-0012 | [[schema/reception-clinical-r1|Clinical versions]] | `SC-R1-CLIN-01..02` |

## Release 2–5

| Release | Capability | Gate |
|---|---|---|
| REG | TT13/TT32 compliance baseline, identity, attestation, operational policy, paper transition | Legal/Clinical/Security/Records owners; matrix không còn blockers |
| R2 | Dependent tiers/evidence/delegated access | Privacy owner ký retention/scope; evidence security test |
| R3 | Episode/CareTeam/Referral | Referral core DoR; `OPEN-REF-01` trước SLA/escalation stories |
| R4 | Order/Result non-critical | Payload/signing tests; critical services disabled đến `OPEN-ORD-02` |
| R5 | Real QR, refund/reversal UI, dashboard/notification hardening | `OPEN-PAY-01`, provider sandbox/reconciliation; KPI dictionary |
| Sau MVP | Inpatient/bed, merge/split, LIS/PACS, insurance | DEFERRED decisions được mở lại |

## Definition of Ready

Story chỉ `READY` khi:

1. Actor/outcome/resource state rõ.
2. Decision/blocker liên quan đã ACCEPTED hoặc OPEN không chặn story.
3. Module/table owner và schema anchor rõ.
4. Permission/action/context rõ.
5. Input/output/error/state transition rõ.
6. Given/When/Then gồm happy path, retry/race, unauthorized và invalid transition khi liên quan.
7. Dependency, test data và NFR rõ.
8. Audit/idempotency/privacy requirement được gắn.
9. Nếu story liên quan HSBA/legal production: có Requirement ID từ [[23-ma-tran-yeu-cau-tt13-2025|matrix]], owner pháp lý/chuyên môn, evidence type và không phụ thuộc ADR `PROPOSED` như contract đã khóa.

## Definition of Done

1. Code, Flyway, JPA và OpenAPI đồng bộ.
2. Unit, integration, ArchUnit layered boundary và migration smoke test đạt.
3. Concurrency/idempotency test đạt khi liên quan.
4. Authorization/audit/privacy negative tests đạt.
5. Không mất clinical/financial history.
6. Metrics/logs/traces/failure path có evidence.
7. Story–Decision–ADR–Schema–Test trace đầy đủ.
8. Không blocker/acceptance failure; docs cập nhật cùng change.
9. Security/static/dependency scan đạt policy.
10. Production story chỉ Done khi backup/restore/runbook/UAT evidence phù hợp.
11. HSBA/legal story chỉ Done khi requirement row đạt `VERIFIED` hoặc `NOT_APPLICABLE_APPROVED`, có owner approval, attestation/identity/record retrieval evidence nếu áp dụng.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[19-ket-qua-phase-0|Phase 0 gate]]
- [[20-so-quyet-dinh-kien-truc|Architecture]]
- [[21-schema-vat-ly-mvp|Schema]]
- [[13-ke-hoach-va-nghiem-thu-mvp|MVP acceptance]]
<!-- related-links:end -->
