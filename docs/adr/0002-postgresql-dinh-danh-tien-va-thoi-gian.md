---
aliases:
  - ADR-0002 PostgreSQL, định danh, tiền và thời gian
artifact_type: adr
status: ACCEPTED
date: 2026-07-30
decision_ids:
  - DATA-01
  - DATA-02
  - DATA-03
  - DATA-04
---
# ADR-0002 — PostgreSQL, định danh, tiền và thời gian

## Context

ERD logic chưa chốt kiểu PK, timestamp, money, naming và delete policy. Các module phải dùng cùng contract trước migration.

## Decision

- PostgreSQL 17.x; Flyway quản lý migration.
- PK/FK dùng PostgreSQL `uuid`; ứng dụng sinh UUIDv7 trước `persist`.
- Table, column, constraint và index dùng `lower_snake_case`; table tên số ít.
- Instant dùng `timestamptz`, DB/JVM chạy UTC; hiển thị mặc định `Asia/Ho_Chi_Minh`. Ngày thuần dùng `date`.
- Tiền dùng `numeric(19,2)` và `char(3)` ISO-4217; MVP chỉ chấp nhận `VND`.
- Entity mutable có `version bigint not null` cho optimistic locking.
- FK mặc định `ON DELETE RESTRICT`; FK phục vụ join được index.
- Clinical, financial và audit không soft-delete/hard-delete. Sửa bằng amendment, reversal, version hoặc trạng thái lỗi.
- Catalog chưa được tham chiếu có thể hard-delete; đã dùng thì ngừng hiệu lực.

## Alternatives rejected

- Auto-increment ID: làm lộ thứ tự, khó sinh ID trước transaction và khó tách module.
- `timestamp without time zone`: dễ tạo lỗi chuyển múi giờ.
- `double` cho tiền: sai số nhị phân.
- Soft-delete toàn cục: làm unique/FK/query phức tạp và che lifecycle thật.

## Consequences

- JPA converter/generator UUIDv7 phải có test.
- API nhận/trả timestamp ISO-8601 có offset; date không chứa timezone.
- Constraint naming: `pk_`, `fk_`, `uk_`, `ck_`; index `ix_`.
- Retention cụ thể theo pháp lý vẫn là gate trước production, không thay delete policy nghiệp vụ.

## Links

- [[../11-mo-hinh-du-lieu|ERD logic]]
- [[../21-schema-vat-ly-mvp|Schema vật lý]]
