# MediCore

Foundation cho modular monolith quản lý quy trình khám bệnh. Workspace hiện chỉ cung cấp toolchain, module boundaries, migration baseline, frontend shell và quality gates. Chưa có feature lâm sàng hoặc tuyên bố tuân thủ TT13/HSBA production.

## Yêu cầu

- Java 21
- Node.js 24.18.1 và npm 11.16.0
- Docker Desktop có Docker Compose
- Git

## Cài dependency

```bash
npm ci
```

## PostgreSQL local

```bash
docker compose -f infra/compose.yaml up -d --wait
```

Backend mặc định kết nối `jdbc:postgresql://localhost:5432/medicore`. Có thể copy `infra/.env.example` thành `infra/.env` rồi điều chỉnh local-only values.

Dừng DB:

```bash
docker compose -f infra/compose.yaml down
```

> Cảnh báo: lệnh sau xóa toàn bộ dữ liệu PostgreSQL local trong volume.
>
> ```bash
> docker compose -f infra/compose.yaml down --volumes
> ```

## Backend

```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Endpoints local:

- Health: `http://localhost:8080/actuator/health`
- OpenAPI R1: `http://localhost:8080/api/v1/medicore.openapi.yaml`
- Swagger UI: `http://localhost:8080/api/v1/swagger-ui`

Chạy test và static analysis:

```bash
cd backend
./mvnw verify
```

Integration tests dùng Testcontainers PostgreSQL 17, cần Docker đang chạy.

## Frontend

```bash
npm --workspace @medicore/frontend run dev
```

Vite proxy `/api` sang backend tại `http://localhost:8080`.

Kiểm frontend:

```bash
npm run frontend:lint
npm run frontend:typecheck
npm run frontend:test
npm run frontend:build
```

## Tài liệu

```bash
npm run docs:check
npm run docs:render
```

Mermaid SVG và manifest được sinh tại `build/docs/mermaid/`, không commit vào Git.

## Kiểm tra tổng

```bash
npm run verify
cd backend && ./mvnw verify
```

## Kiến trúc backend

Backend R1-01 dùng Enterprise Layered Architecture ngang:

- `common`: exception và utility dùng chung
- `config`: framework configuration
- `controller`: REST API và HTTP filter
- `dto`: request/response model và principal
- `entity`: entity, value object, enum
- `repository`: data-access interface/JDBC implementation
- `service`: business service interface/implementation

Dependency đi một chiều: `controller` → `service` → `repository` → `entity`. `LayeredArchitectureTest` là regression gate; controller không truy cập repository/entity trực tiếp, service không phụ thuộc controller, repository không phụ thuộc tầng trên.

Vertical Spring Modulith modules chỉ được thêm sau ADR/refactor package topology riêng; không có module marker giả trong R1-01.

## Điều kiện local

Backend cần Java 21 và Docker để chạy Testcontainers PostgreSQL 17:

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
cd backend && ./mvnw --batch-mode --no-transfer-progress verify
```

## GitHub follow-up

Repository local chưa có remote, branch protection hoặc license. Trước khi publish cần chốt GitHub owner/repository visibility, license và provenance của `tvpl-ocr.jpg`.
