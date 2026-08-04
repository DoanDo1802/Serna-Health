---
aliases:
  - ADR-0001 Stack và modular monolith
artifact_type: adr
status: ACCEPTED
date: 2026-07-30
decision_ids:
  - ARCH-01
  - ARCH-02
  - ARCH-03
  - TECH-01
---
# ADR-0001 — Stack và modular monolith

## Context

MediCore cần phát triển MVP nhanh nhưng domain y tế, transaction, RBAC và audit cần boundary rõ. Nhóm chọn React cho UI và hệ sinh thái Java cho backend.

## Decision

- Frontend: React 19 + TypeScript, build bằng Vite; Node.js 24 LTS làm toolchain.
- Backend: Java 21 LTS, Spring Boot 3.5.x, Spring Modulith, Spring Data JPA/Hibernate, Flyway.
- Database: PostgreSQL 17.x.
- Contract ngoài: REST/JSON và OpenAPI.
- MVP dùng một backend deployment và một PostgreSQL database; chưa tách microservice.
- Module: `identity-access`, `catalog`, `patient`, `scheduling`, `reception-queue`, `clinical-care`, `diagnostics`, `billing-payment`, `notification`, `platform-audit`.
- Module khác chỉ gọi public application API hoặc domain event; không chia sẻ JPA entity. Tham chiếu xuyên module bằng ID.
- Không bắt buộc Redis/Kafka trong Release 1. Outbox nằm trong PostgreSQL.

## Alternatives rejected

- Next.js + NestJS: nhanh và đồng nhất TypeScript nhưng không phải lựa chọn của nhóm.
- React + .NET: phù hợp Azure nhưng nhóm không chọn C#.
- Microservices: tăng chi phí vận hành, consistency và tracing trước khi có nhu cầu scale độc lập.

## Consequences

- Boundary module phải được kiểm tra bằng Spring Modulith test.
- Một transaction có thể giữ invariant xuyên bảng ổn định trong cùng DB.
- Khi tách service sau này, public API/domain event và ownership bảng là điểm cắt.
- Patch version được pin khi scaffold Phase 1; ADR khóa major/minor baseline.

## Constraints

Không đưa business logic vào controller/JPA listener. Module sở hữu migration, bảng và event của mình.

## Follow-up

Scaffold React/Spring Boot, Flyway và OpenAPI chỉ thực hiện sau gate Phase 0.

## Links

- [[../20-so-quyet-dinh-kien-truc|Kiến trúc baseline]]
- [[../21-schema-vat-ly-mvp|Schema vật lý]]
- [[../22-backlog-mvp|Backlog]]
