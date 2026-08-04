---
aliases:
  - Architecture Decision Records
  - ADR
artifact_type: architecture-decisions
status: ACCEPTED
---
# Architecture Decision Records

[[../20-so-quyet-dinh-kien-truc|Sổ quyết định kiến trúc]] · [[../14-gia-dinh-cau-hoi-va-dinh-huong#22.1. Quyết định đã chốt|Sổ quyết định canonical]] · [[../docs|Mục lục]]

## Quy ước

- `PROPOSED`: đang review, chưa được dùng làm contract triển khai hoặc production evidence.
- `ACCEPTED`: đã khóa; thay đổi lớn phải tạo ADR mới.
- `SUPERSEDED`: được ADR mới thay thế, giữ để truy nguyên.
- `REJECTED`: đã xem xét nhưng không chọn.
- Mỗi ADR liên kết Decision ID trong file 14. Trạng thái quyết định canonical nằm tại file 14.
- ADR chỉ sở hữu bối cảnh, lựa chọn, lý do và hệ quả; schema vật lý nằm tại [[../21-schema-vat-ly-mvp|Schema vật lý MVP]].

## Danh sách ADR

| ADR | Trạng thái | Phạm vi |
|---|---|---|
| [[0001-stack-va-modular-monolith|ADR-0001 — Stack và modular monolith]] | ACCEPTED | React, Spring Boot, module boundary |
| [[0002-postgresql-dinh-danh-tien-va-thoi-gian|ADR-0002 — PostgreSQL, định danh, tiền và thời gian]] | ACCEPTED | DB, UUIDv7, UTC, money |
| [[0003-concurrency-idempotency-inbox-outbox|ADR-0003 — Concurrency, idempotency, inbox/outbox]] | ACCEPTED | Locking, dedup, reliability |
| [[0004-actor-rbac-audit-va-dependent-privacy|ADR-0004 — Actor, RBAC, audit và dependent privacy]] | ACCEPTED | IAM, quyền, evidence |
| [[0005-appointment-checkin-queue-va-reschedule|ADR-0005 — Appointment, CheckIn, queue và reschedule]] | ACCEPTED | Reception workflow |
| [[0006-payment-slothold-va-billing-ledger|ADR-0006 — Payment–SlotHold và billing ledger]] | ACCEPTED | PaymentIntent, ChargeItem, ledger |
| [[0007-clinical-record-va-result-versioning|ADR-0007 — Clinical record và Result versioning]] | ACCEPTED | Note, Diagnosis, Result |
| [[0008-ranh-gioi-tuan-thu-ky-xac-nhan-va-dinh-danh-dien-tu|ADR-0008 — Ranh giới tuân thủ, ký/xác nhận và định danh điện tử]] | PROPOSED | Compliance boundary, attestation, identity |
| [[0009-foundation-toolchain-va-ci|ADR-0009 — Foundation toolchain và CI]] | ACCEPTED | Monorepo, build tools, version pinning, CI |
| [[0010-authentication-session-va-account-security|ADR-0010 — Authentication, session và account security]] | ACCEPTED | Login, credential, OTP, session, recovery, lockout |
| [[0011-provider-event-time-va-reschedule-deposit|ADR-0011 — Provider event time và reschedule deposit]] | ACCEPTED | Webhook time trust, deposit allocation/transfer |
| [[0012-technical-finalization-va-lawful-signing-boundary|ADR-0012 — Technical finalization và lawful signing boundary]] | ACCEPTED | FINALIZED technical state, lawful SIGNED gate |
| [[0013-api-contract-versioning-error-idempotency|ADR-0013 — API contract, versioning, error và idempotency]] | ACCEPTED | OpenAPI source-first, headers, errors, concurrency |

## Artifact liên quan

- [[../23-ma-tran-yeu-cau-tt13-2025|Ma trận yêu cầu TT13]].
- [[../24-khung-quy-che-van-hanh-hsba-dien-tu|Khung quy chế vận hành — DRAFT]].
