---
aliases:
  - ADR-0013 API contract, versioning, error và idempotency
artifact_type: adr
status: ACCEPTED
date: 2026-08-04
decision_ids:
  - API-01
  - API-02
  - API-03
  - API-04
  - API-05
  - API-06
---
# ADR-0013 — API contract, versioning, error và idempotency

## Context

Release 1 đã có story/schema/scenario nhưng chưa có external API source-of-truth. Runtime Springdoc spec rỗng không cho frontend/backend phát triển song song hoặc kiểm breaking change.

## Decision

- External API dùng source-first OpenAPI 3.1 tại `contracts/openapi`, base `/api/v1`; module sở hữu path/schema fragment, root bundle là contract giao tiếp canonical.
- Browser authentication dùng opaque `MEDICORE_SESSION` cookie. Unsafe request cần `X-CSRF-Token`. Provider webhook dùng signature headers, không dùng session cookie.
- `X-Request-Id` và `X-Correlation-Id` dùng trace. `Idempotency-Key` bắt buộc cho create/command có retry risk. Cùng key khác canonical request hash trả conflict.
- Mutable resource trả strong ETag từ optimistic version. Update/state transition cần `If-Match`; missing/stale precondition trả 428/412.
- Error dùng `application/problem+json` theo RFC 9457 và thêm stable `code`, request/correlation IDs, field errors, blockers, retry delay.
- List endpoint dùng opaque cursor, limit mặc định 20 và tối đa 100. Timestamp ISO-8601 có offset; UUID chuẩn; money truyền bằng decimal string + currency để tránh binary float.
- State transition dùng `/resources/{id}/actions/{verb}`; không tạo direct endpoint bỏ qua invariant, như `POST /appointments` hoặc public create ChargeItem.
- Mỗi operation phải có owner, permission/security, audit action, story và scenario trace qua `x-medicore-*` extensions.

## Versioning

- `/api/v1` chỉ đổi khi có breaking change đã review. Compatible additions được phép trong v1.
- Breaking gồm xóa/đổi operation, thêm required input, thu hẹp enum, đổi status/error semantics hoặc security requirement.
- Bundled spec được commit để consumer dùng; CI lint/bundle/check deterministic và so sánh artifact.

## Alternatives rejected

- Code-first runtime spec: controller implementation trở thành nguồn chuẩn và cho contract drift trước feature coding.
- JWT browser token: trái session/revocation contract ADR-0010.
- Offset pagination: không ổn định khi queue/payment data thay đổi liên tục.
- HTTP 200 cho mọi domain error: làm mất cache/proxy/client semantics.

## Consequences

- Controller/DTO tương lai phải conform spec, không tự mở path/schema mới.
- Storage schema không xuất 1:1; secret/hash/internal inbox-outbox không có public DTO.
- Blocked/later capability không xuất hiện trong R1 bundle.

## Links

- [[../25-api-inventory-r1|API inventory R1]]
- [[../20-so-quyet-dinh-kien-truc|Architecture baseline]]
- [[../22-backlog-mvp|Backlog R1]]
- [[0010-authentication-session-va-account-security|ADR-0010]]
