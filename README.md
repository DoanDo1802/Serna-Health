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

## Module backend

Spring Modulith nhận đúng 10 module canonical:

- `identity-access`
- `catalog`
- `patient`
- `scheduling`
- `reception-queue`
- `clinical-care`
- `diagnostics`
- `billing-payment`
- `notification`
- `platform-audit`

Module khác chỉ được gọi public application API/domain event khi feature bắt đầu. Không chia sẻ JPA entity.

## GitHub follow-up

Repository local chưa có remote, branch protection hoặc license. Trước khi publish cần chốt GitHub owner/repository visibility, license và provenance của `tvpl-ocr.jpg`.
