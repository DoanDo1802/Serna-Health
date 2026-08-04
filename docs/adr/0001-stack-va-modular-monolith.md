---
aliases:
  - ADR-0001 Stack và layered architecture
artifact_type: adr
status: ACCEPTED
date: 2026-07-30
decision_ids:
  - ARCH-01
  - ARCH-02
  - ARCH-03
  - TECH-01
---
# ADR-0001 — Stack và Layered Architecture

## Context

MediCore cần phát triển MVP nhanh nhưng domain y tế, transaction, RBAC và audit cần boundary rõ. Nhóm chọn React cho UI và hệ sinh thái Java cho backend.

## Decision

- Frontend: React 19 + TypeScript, build bằng Vite; Node.js 24 LTS làm toolchain.
- Backend: Java 21 LTS, Spring Boot 3.5.x, Enterprise 5-Layered Architecture (`common`, `config`, `controller`, `dto`, `entity`, `repository`, `service`).
- Database: PostgreSQL 17.x, Flyway migration.
- Contract ngoài: REST/JSON và OpenAPI 3.1.
- MVP dùng một backend deployment và một PostgreSQL database; chưa tách microservice.
- Kiến trúc phân tầng ngang (Layered Architecture): `controller` -> `service` -> `repository` -> `entity`.
- Không bắt buộc Redis/Kafka trong Release 1. Outbox nằm trong PostgreSQL.

## Alternatives rejected

- Next.js + NestJS: nhanh và đồng nhất TypeScript nhưng không phải lựa chọn của nhóm.
- React + .NET: phù hợp Azure nhưng nhóm không chọn C#.
- Microservices: tăng chi phí vận hành, consistency và tracing trước khi có nhu cầu scale độc lập.

## Consequences

- Ranh giới giữa các tầng được kiểm tra bằng ArchUnit `LayeredArchitectureTest`.
- Một transaction có thể giữ invariant xuyên bảng ổn định trong cùng DB.
- Không đưa business logic vào controller hay JPA listener; tập trung xử lý tại `service/impl`.

## Follow-up

Scaffold React/Spring Boot, Flyway và OpenAPI chỉ thực hiện sau gate Phase 0.

## Links

- [[../20-so-quyet-dinh-kien-truc|Kiến trúc baseline]]
- [[../21-schema-vat-ly-mvp|Schema vật lý]]
- [[../22-backlog-mvp|Backlog]]
