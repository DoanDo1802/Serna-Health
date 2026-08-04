---
aliases:
  - ADR-0005 Appointment, CheckIn, queue và reschedule
artifact_type: adr
status: ACCEPTED
date: 2026-07-30
decision_ids:
  - CHECKIN-01
  - QUEUE-06
  - QUEUE-07
  - VISIT-01
  - VISIT-02
  - APT-06
---
# ADR-0005 — Appointment, CheckIn, queue và reschedule

## Context

Check-in cần idempotency/audit nhưng chưa là resource; queue chưa có states; reschedule thiếu lineage; NO_SHOW và Visit completion mơ hồ.

## Decision

- `CheckIn` là resource canonical. Release 1 chỉ staff-assisted; self check-in web để release sau.
- Queue states: `WAITING`, `CALLED`, `IN_SERVICE`, `DEFERRED`, `COMPLETED`, `CANCELLED`, `ENTERED_IN_ERROR`.
- Một Encounter có thể có nhiều QueueEntry lịch sử nhưng tối đa một entry active.
- Số gọi unique theo `(service_date, department_id, queue_number)`.
- Queue mặc định xen 1 bệnh nhân tồn sau mỗi 3 bệnh nhân ca hiện tại. Department có thể override bằng QueuePolicy versioned/audited.
- `NO_SHOW` chỉ từ Appointment `CONFIRMED` chưa có CheckIn/Visit hợp lệ tại thời điểm đóng ca.
- Reschedule tạo Appointment mới; lịch mới giữ `rescheduled_from_id`, lịch cũ giữ `rescheduled_to_id`; hai chiều được commit cùng transaction và mỗi lịch cũ có tối đa một lịch thay thế.
- `DEFERRED` là trạng thái active/nonterminal vì có thể quay lại `WAITING`. QueueEntry terminal chỉ gồm `COMPLETED`, `CANCELLED`, `ENTERED_IN_ERROR`.
- Visit hoàn tất khi mọi Encounter terminal và mọi QueueEntry ở `COMPLETED`, `CANCELLED` hoặc `ENTERED_IN_ERROR`, đồng thời không còn same-day Referral chờ xử lý. Order, Result, Episode hoặc billing mở tạo warning/follow-up, không chặn clinical completion.
- Visit/Encounter đang `IN_PROGRESS` có thể `CANCELLED` hoặc `ENTERED_IN_ERROR` bởi role có quyền, bắt buộc reason/audit.

## Alternatives rejected

- CheckIn chỉ là audit JSON: khó query ngoại lệ và enforce đúng một check-in.
- Đổi slot trên Appointment cũ: mất lịch sử và làm sai liên kết cọc.
- Queue chỉ suy từ `checked_in_at`: không biểu diễn call/serve/defer.

## Qualification

Deposit funding/transfer của reschedule được khóa tại [[0011-provider-event-time-va-reschedule-deposit|ADR-0011]]. Reciprocal Appointment lineage trong ADR này không cho phép ghi đè Payment hoặc transfer best-effort sau commit.

## Consequences

- Capacity tính mọi reservation chưa hủy/no-show, gồm Appointment `CONFIRMED` và `FULFILLED`; check-in không giải phóng chỗ.
- Queue adjustment không sửa `checked_in_at`.
- Visit completion command trả warnings tách khỏi hard blockers.

## Links

- [[../04-vong-doi-va-nghiep-vu-lich-kham|Vòng đời]]
- [[../09-ngoai-le-va-quy-tac-nghiep-vu|Ngoại lệ]]
