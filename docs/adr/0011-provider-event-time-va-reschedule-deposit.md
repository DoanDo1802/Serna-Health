---
aliases:
  - ADR-0011 Provider event time và reschedule deposit
artifact_type: adr
status: ACCEPTED
date: 2026-08-04
decision_ids:
  - PAY-06
  - PAY-07
  - APT-04
  - APT-06
---
# ADR-0011 — Provider event time và reschedule deposit

## Context

Late payment phụ thuộc `provider_occurred_at` nhưng schema chưa có typed evidence/trust rule. Reschedule yêu cầu chuyển cọc nhưng Payment chỉ có optional Appointment FK, không biểu diễn immutable transfer hoặc chênh lệch cọc.

## Decision

### Provider event time

- Adapter chuẩn hóa event thành provider, event ID/type, transaction ID, provider occurred time, received time, amount/currency, signature status, payload hash và correlation ID.
- `provider_occurred_at` phải nằm trong signed payload, parse được thành instant có offset và được persist typed `timestamptz` trên WebhookInbox/Payment evidence.
- Timestamp trusted khi signature `VALID`, field có mặt/parse được và không vượt clock-skew policy ±5 phút quanh `received_at`. Missing, invalid hoặc untrusted time không tạo Appointment; PaymentIntent thành `RECONCILIATION_REQUIRED`.
- Success hợp lệ cho booking chỉ khi `provider_occurred_at < slot_hold.expires_at` và reservation còn hợp lệ trong transaction. Bằng expiry là late. `received_at` không thay business time.

### Reschedule deposit

- Payment capture bất biến. Deposit được gắn Appointment bằng immutable `deposit_allocation`; `deposit_transfer` giữ old/new allocation lineage. Không cập nhật `payment.appointment_id` để “chuyển” cọc.
- Workflow giữ SlotHold mới và tính cọc mới trước. Khi đủ funding, một transaction khóa old/new Appointment, SlotHold, Payment/allocation và slot; sau đó tạo Appointment mới, transfer allocation, chuyển lịch cũ `RESCHEDULED`, ghi reciprocal lineage và outbox/audit.
- Cọc bằng nhau: transfer toàn bộ allocation.
- Cọc mới cao hơn: thu thêm phần chênh trước commit. Failure/timeout giữ lịch và allocation cũ nguyên trạng.
- Cọc mới thấp hơn: transfer đúng required amount; phần dư ghi `REFUND_PENDING`/reconciliation item. External refund thực thi qua outbox sau commit, không làm mất capture lineage.
- Retry dùng idempotency scope `appointment.reschedule`; cùng key khác payload conflict. Lỗi trước commit rollback toàn bộ state nội bộ.

## Alternatives rejected

- Dùng webhook receive time: network delay làm sai expiry boundary.
- Tin provider timestamp không cần signature/range check: attacker hoặc provider defect có thể backdate/future-date event.
- Đổi `Payment.appointment_id`: ghi đè lineage tài chính và không biểu diễn partial transfer.
- Commit lịch mới rồi sửa cọc best-effort: tạo lịch không đủ funding hoặc mất cọc.

## Consequences

- Mock adapter phải mô phỏng before/equal/after expiry, duplicate, out-of-order, invalid signature, missing timestamp và future timestamp.
- Schema thêm typed provider time/trust outcome, deposit allocation và transfer.
- Real provider vẫn bị chặn bởi `OPEN-PAY-01`; ADR này chỉ khóa port/evidence semantics R1.

## Links

- [[0003-concurrency-idempotency-inbox-outbox|ADR-0003 — Concurrency, idempotency, inbox/outbox]]
- [[0005-appointment-checkin-queue-va-reschedule|ADR-0005 — Appointment, CheckIn, queue và reschedule]]
- [[0006-payment-slothold-va-billing-ledger|ADR-0006 — Payment–SlotHold và billing ledger]]
- [[../schema/scheduling-payment-r1|Schema scheduling/payment R1]]
- [[../22-backlog-mvp|Backlog và acceptance payment]]
