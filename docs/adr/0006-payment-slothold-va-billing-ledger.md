---
aliases:
  - ADR-0006 Payment–SlotHold và billing ledger
artifact_type: adr
status: ACCEPTED
date: 2026-07-30
decision_ids:
  - PAY-02
  - PAY-03
  - PAY-04
  - PAY-05
  - BILL-06
  - BILL-07
  - BILL-08
  - BILL-09
---
# ADR-0006 — Payment–SlotHold và billing ledger

## Context

Payment xảy ra trước Appointment nhưng chưa liên kết SlotHold; late success có thể oversell; doanh thu dựa current Payment status có thể trừ Refund hai lần; ChargeItem có hai nguồn nullable.

## Decision

- `PaymentIntent` tách khỏi `Payment`, liên kết SlotHold và provider adapter trước khi Appointment tồn tại.
- Adapter provider-neutral; mock adapter là adapter Release 1. Provider thật vẫn `OPEN-PAY-01`.
- Event/command qua webhook inbox. Success hợp lệ khóa slot và cập nhật PaymentIntent, Payment, SlotHold, Appointment trong transaction.
- PaymentIntent là resource nhận trạng thái `RECONCILIATION_REQUIRED`; Payment capture vẫn bất biến ở `CAPTURED`. Provider success chỉ hợp lệ khi `provider_occurred_at < slot_hold.expires_at` và reservation vẫn được chứng minh trong transaction. Tại hoặc sau `expires_at`, hoặc khi reservation không còn, không tạo Appointment; PaymentIntent vào reconciliation/refund workflow.
- Provider transaction ID unique theo provider; request amount/currency phải khớp snapshot.
- `ServiceDelivery` là nguồn canonical của ChargeItem; unique một original ChargeItem mỗi delivery.
- ChargeItem lưu quantity, unit price, discount snapshot, gross/net amount và currency.
- Payment capture là money movement bất biến; Refund là money movement ra riêng. Current workflow status không dùng làm ledger.
- `charge_total` là tổng net amount hợp lệ, loại bản reversed; `paid_total` là allocation capture trừ refund completed; `balance_due = charge_total - paid_total`.
- RefundRequest nhắm Payment; ChargeItemReversalRequest nhắm ChargeItem, không dùng payment_id giả.
- BillingAccount đóng khi Visit hoàn tất, mọi delivery đã charge/reverse, không có transaction pending và balance bằng 0. Reopen cần manager permission, reason, version, audit.

## Alternatives rejected

- Payment chỉ tham chiếu Appointment: Appointment chưa tồn tại lúc trả tiền.
- Hai FK nullable Encounter/Order trên ChargeItem: không enforce đúng một nguồn và dễ double-charge.
- Doanh thu từ current Payment status: sai khi refund.

## Qualification

Trust contract cho `provider_occurred_at` và immutable deposit allocation/transfer được khóa tại [[0011-provider-event-time-va-reschedule-deposit|ADR-0011]].

## Consequences

- Late webhook tests tại trước/đúng/sau `expires_at` bắt buộc.
- Mock adapter phải mô phỏng duplicate, out-of-order, invalid signature và delayed success.
- Provider thật không được vào DoR trước khi `OPEN-PAY-01` đóng.

## Links

- [[../05-thanh-toan-va-doanh-thu|Thanh toán]]
- [[../18-billing-account-va-charge-item|Billing]]
- [[../21-schema-vat-ly-mvp|Schema vật lý]]
