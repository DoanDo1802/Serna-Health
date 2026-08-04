# MediCore Project Agent Rules & Coding Standards

Mọi AI Agent làm việc trong dự án **MediCore** bắt buộc tuân thủ các quy tắc kiến trúc, chuẩn lập trình và quy trình Git sau:

---

## 1. Cấu trúc Kiến trúc & Gói (Enterprise Layered Architecture)

Mã nguồn Backend (`backend/src/main/java/vn/medicore`) tuân thủ 100% mô hình Phân tầng Ngang (Horizontal Slicing):

1. **`vn.medicore.common`**:
   - `base/`: Chứa các Base Classes (`BaseEntity`, `BaseController`...).
   - `constants/`: Hằng số hệ thống (`ErrorCodes`, `SystemConstants`...).
   - `exception/`: Chứa `GlobalExceptionHandler` (`@RestControllerAdvice`) và toàn bộ Custom Business Exceptions (`InvalidAuthenticationException`, `ResourceNotFoundException`, `RateLimitException`, `InvalidCsrfException`, `StaleVersionException`...).
   - `utils/`: Các helper thuần Java (`UuidV7Generator.java`, `DateUtils`...).
2. **`vn.medicore.config`**:
   - Cấu hình Framework (`SecurityConfig.java`, `AuthProperties.java`, `SecretHasher.java`, `OpenApiConfig.java`, `DatabaseConfig.java`).
3. **`vn.medicore.controller`**:
   - Tầng API REST Controllers (`IdentityAccessController`, `PlatformAuditController`...) và Filters (`SessionAuthenticationFilter`, `IdempotencyFilter`).
4. **`vn.medicore.dto`**:
   - Chứa Data Transfer Objects (`request/`, `response/`, `IdentityModels`, `AuditModels`, `AuthenticatedAccount`).
5. **`vn.medicore.entity`**:
   - Entities (`UserAccount`, `AccountSession`, `AuthenticationChallenge`), Value Objects (`EmailAddress`), Enums (`AccountStatus`).
6. **`vn.medicore.repository`**:
   - Data Access Interfaces (`IdentityRepository`, `PlatformAuditRepository`) và mã thực thi trong gói `impl/` (`IdentityJdbcRepositoryImpl`, `PlatformAuditJdbcRepositoryImpl`).
7. **`vn.medicore.service`**:
   - Business Service Interfaces (`IdentityAccessService`, `PlatformAuditService`, `AuthenticationDeliveryService`) và mã thực thi trong gói `impl/` (`IdentityAccessServiceImpl`, `PlatformAuditServiceImpl`, `IdempotencyServiceImpl`, `SecurityAuditServiceImpl`, `PasswordPolicy`, `LoggingAuthenticationDeliveryImpl`, `SmtpAuthenticationDeliveryImpl`).

---

## 2. Quy tắc Kiểm soát Ranh giới Phân tầng (Layering Rules)

- **Luồng gọi một chiều (Strict Downward Flow)**: `controller` $\rightarrow$ `service` $\rightarrow$ `repository` $\rightarrow$ `entity`.
- **Tuyệt đối KHÔNG**:
  - Không gọi `repository` hay truy vấn CSDL trực tiếp từ `controller`.
  - Không viết logic nghiệp vụ (business logic) trong `controller` hay JPA entity.
  - Không gọi ngược từ tầng dưới lên tầng trên.
- **Xác minh bắt buộc**: Mỗi khi thêm/sửa class mới, Agent phải chạy ArchUnit test để xác minh tuân thủ ranh giới:
  ```bash
  JAVA_HOME=/usr/local/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home ./mvnw test -Dtest=LayeredArchitectureTest
  ```

---

## 3. Quy tắc Xử lý Lỗi (Exception & Error Handling)

- **Tất cả Business Exceptions** phải kế thừa `RuntimeException` và nằm tại package `vn.medicore.common.exception`.
- **Tuyệt đối KHÔNG** swallow exception hay trả về fallback dummy ngầm.
- **Bắt lỗi tập trung**: Xử lý duy nhất tại `GlobalExceptionHandler` (`@RestControllerAdvice`), trả về RFC 7807 `ProblemDetail` chứa các thuộc tính chuẩn: `code`, `requestId`, `correlationId`.

---

## 4. Quy tắc An ninh & Audit (Security & Audit Controls)

- **Authentication**: Sử dụng Session Cookie `MEDICORE_SESSION` (HttpOnly, Secure, SameSite) kết hợp kiểm tra CSRF token header (`X-CSRF-Token`) cho các HTTP method có tính biến đổi dữ liệu (`POST`, `PUT`, `DELETE`, `PATCH`).
- **Audit Logging**: Mọi thao tác nhạy cảm (như Break-Glass grant, thay đổi trạng thái tài khoản, phân quyền) bắt buộc phải gọi `PlatformAuditService` hoặc `SecurityAuditRecorder` để ghi log audit append-only vào bảng `audit_event`.

---

## 5. Quy tắc Đồng thời & Khóa (Concurrency & Locking)

- **Optimistic Locking**: Sử dụng trường `version` trên Entity/Table để chống tranh chấp dữ liệu (gây ra lỗi `StaleVersionException` / HTTP `412 Precondition Failed`).
- **Advisory Locks**: Các luồng nhạy cảm chống Spam/Rate Limit (như đăng ký tài khoản, gửi mã OTP) phải khóa bằng PostgreSQL Advisory Locks (`pg_advisory_xact_lock`).

---

## 6. Tuân thủ Hợp đồng OpenAPI (Contract-First)

- Tất cả API Endpoints, HTTP Status codes, Request/Response DTOs phải khớp 100% với hợp đồng OpenAPI tại `contracts/openapi/medicore.openapi.yaml`.
- Không tự ý thêm bớt field JSON ngoài hợp đồng khi chưa cập nhật spec.

---

## 7. Quy tắc Git Workflow (Branching, Staging & Commit)

### A. Đặt tên Nhánh (Branch Naming)
- **Feature tính năng**: `feat/<ma-backlog>-<ten-ngan-gon>` (Ví dụ: `feat/r1-02-authentication`, `feat/r1-05-patient-management`)
- **Sửa lỗi Bugfix**: `fix/<ma-issue>-<ten-ngan-gon>` (Ví dụ: `fix/r1-02-csrf-validation`)
- **Tái cấu trúc Refactor**: `refactor/<ten-chuc-nang>` (Ví dụ: `refactor/backend-layered-architecture`)
- **Tài liệu Docs**: `docs/<ten-tai-lieu>` (Ví dụ: `docs/update-architecture-adr`)

### B. Staging (`git add`)
- Chỉ `git add` các file liên quan trực tiếp tới công việc.
- Kiểm tra loại trừ file rác, file tạm, build artifacts (`.DS_Store`, `target/`, `node_modules/`, `.claude/worktrees/`).

### C. Chuẩn Commit Message (Conventional Commits)
- **Định dạng**: `<type>(<scope>): <mô tả ngắn gọn>`
- **Các type được phép**:
  - `feat`: Tính năng mới
  - `fix`: Sửa lỗi
  - `refactor`: Tái cấu trúc code (không đổi API response)
  - `docs`: Cập nhật tài liệu
  - `test`: Thêm hoặc sửa unit/integration test
  - `chore`: Cập nhật build script, dependency, cấu hình
- **Ví dụ**:
  - `feat(auth): implement OTP authentication flow`
  - `refactor(backend): restructure backend to 7-layer architecture`
  - `docs(arch): update directory tree and git workflow rules`
