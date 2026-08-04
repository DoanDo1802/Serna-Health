---
aliases:
  - ADR-0003 Concurrency, idempotency, inbox và outbox
artifact_type: adr
status: ACCEPTED
date: 2026-07-30
decision_ids:
  - DATA-05
  - REL-01
  - REL-02
---
# ADR-0003 — Concurrency, idempotency, inbox và outbox

## Context

SlotHold, check-in, webhook, ChargeItem và state transition có retry/concurrency. Chỉ optimistic locking không đủ cho capacity; chỉ client key không đủ chống replay khác payload.

## Decision

- Aggregate mutable dùng optimistic locking.
- Tạo/chốt SlotHold khóa hàng AppointmentSlot trong transaction; invariant đếm reservation chưa hủy phải giữ dưới capacity.
- Command idempotency lưu `(principal_scope, operation, key)`, request hash, response reference và expiry. Reuse cùng key khác payload bị từ chối.
- Webhook vào `webhook_inbox` với provider/event ID unique, signature status, payload hash, received/processed timestamps và lỗi cuối.
- Side effect bất đồng bộ ghi `outbox_event` trong cùng transaction với domain change.
- Consumer idempotent; retry có backoff và dead-letter state trong DB.
- Correlation ID đi xuyên command, audit, inbox và outbox.

## Alternatives rejected

- Redis lock làm nguồn chân lý: thêm dependency và không thay DB invariant.
- Xử lý webhook trực tiếp không inbox: mất replay/audit và dễ tạo trùng.
- Gửi email/event trước commit: có thể phát side effect khi transaction rollback.

## Consequences

- Release 1 phải có concurrency test tại boundary SlotHold expiry/capacity.
- Outbox dispatcher chạy trong application; broker có thể thêm sau mà không đổi domain event.
- Bảng reliability có retention và cleanup job nhưng không xóa trước cửa sổ audit/replay.

## Links

- [[../04-vong-doi-va-nghiep-vu-lich-kham|Scheduling]]
- [[../05-thanh-toan-va-doanh-thu|Thanh toán]]
- [[../12-yeu-cau-phi-chuc-nang|NFR]]
