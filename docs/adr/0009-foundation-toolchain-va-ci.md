---
aliases:
  - ADR-0009 Foundation toolchain và CI
artifact_type: adr
status: ACCEPTED
date: 2026-08-03
decision_ids:
  - ARCH-01
  - ARCH-02
  - DATA-01
  - TECH-01
---
# ADR-0009 — Foundation toolchain và CI

## Context

ADR-0001 khóa baseline major/minor nhưng để patch version, build tool, repository layout và CI cho Phase 1. Story R1-01 cần build lặp lại trước feature coding.

## Decision

- Dùng monorepo gồm `backend`, `frontend`, `tools`, `infra` và tài liệu hiện có.
- Backend dùng Maven Wrapper, Java 21, group/base package `vn.medicore` và một Spring Boot artifact `medicore-backend`.
- Frontend và công cụ tài liệu dùng npm workspaces, Node.js 24 LTS và exact dependency versions trong một lockfile.
- Local database dùng Docker Compose PostgreSQL 17; integration test dùng Testcontainers PostgreSQL 17.
- GitHub Actions chạy document, frontend, backend, ArchUnit layered boundary, migration và security/static gates.
- OpenAPI dùng code-first foundation tại `/api/v1`; chưa sinh client khi chưa có operation nghiệp vụ.
- Flyway bắt đầu bằng migration baseline không có domain DDL. Domain migration chỉ thêm khi schema contract tương ứng đủ chi tiết.
- Dependency, container image và CI action được pin; update đi qua pull request và toàn bộ gate.

## Alternatives rejected

- Gradle: hợp lệ nhưng nhóm chọn Maven để giảm quyết định và dùng Spring ecosystem mặc định.
- Nhiều repository hoặc microservice: trái deployment baseline Release 1 và tăng overhead.
- H2 cho integration test: không bảo đảm semantics PostgreSQL/Flyway.
- Sinh toàn bộ R1 DDL từ tài liệu hiện tại: schema contract chưa khóa đủ type, nullability và constraint.
- Floating dependency ranges: làm build không tái lập.

## Consequences

- Local và CI cần Java 21, Node 24, npm, Docker và Maven Wrapper.
- ArchUnit layered boundary là regression gate từ commit foundation. Spring Modulith chỉ được đưa vào gate khi package topology được thay đổi bằng ADR/refactor riêng.
- Baseline không tạo entity, business endpoint hoặc domain table.
- GitHub remote, visibility, branch protection và license được chốt riêng trước khi publish.

## Links

- [[0001-stack-va-modular-monolith|ADR-0001 — Stack và modular monolith]]
- [[0002-postgresql-dinh-danh-tien-va-thoi-gian|ADR-0002 — PostgreSQL, định danh, tiền và thời gian]]
- [[../20-so-quyet-dinh-kien-truc|Sổ quyết định kiến trúc]]
- [[../22-backlog-mvp|Backlog MVP]]
