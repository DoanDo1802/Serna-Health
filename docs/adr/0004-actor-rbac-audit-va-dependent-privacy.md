---
aliases:
  - ADR-0004 Actor, RBAC, audit và dependent privacy
artifact_type: adr
status: ACCEPTED
date: 2026-07-30
decision_ids:
  - IAM-01
  - CAT-01
  - SEC-03
  - SEC-04
  - SEC-05
  - DEP-06
  - DEP-07
  - DEP-08
  - DEP-09
  - DEP-10
  - DEP-11
---
# ADR-0004 — Actor, RBAC, audit và dependent privacy

## Context

Doctor/KTV/Admin đang bị gộp theo tác nhân thô; quyền thực tế phụ thuộc role, khoa, quan hệ điều trị, dependent scope và thời gian. Evidence không được lưu binary trong JSON/DB.

## Decision

- `UserAccount` là principal; `Practitioner` là nhân sự chuyên môn. Practitioner có `user_account_id` unique nullable để ánh xạ principal sang hồ sơ nhân sự; account bị khóa không thể sử dụng PractitionerRole. Doctor là Practitioner có PractitionerRole `DOCTOR`, không có bảng Doctor riêng.
- Catalog canonical: Department, Room, Service, ServicePrice và PractitionerRole; assignment có hiệu lực theo thời gian.
- Permission theo action `resource.action`; Role chỉ bundle permission. Authorization cuối kết hợp role, practitioner role, department, treatment relationship, dependent grant và thời gian.
- Default deny. Tách quyền nhập, ký, publish, amend, approve và execute.
- Audit append-only lưu actor type/account, effective-role snapshot, purpose of use, authorization basis, resource/version, action, outcome, reason, source/session/request/correlation ID, export/download indicator, before/after phù hợp và timestamp.
- Break-glass có requester, grantor hoặc policy mechanism, Patient scope, purpose, reason, TTL tối đa 4 giờ, auto-expiry, alert, reviewer và review outcome bắt buộc trong 1 ngày làm việc.
- Dependent tiers:
  - Tier 0 `PENDING`: demographics tối thiểu, booking, payment, queue.
  - Tier 1 `IDENTITY_VERIFIED`: hành chính Visit và billing; chưa xem clinical content.
  - Tier 2 `REPRESENTATION_VERIFIED`: clinical read theo permission scope.
- Người lớn cần OTP consent hoặc ủy quyền hợp lệ; trẻ em cần giấy khai sinh và xác minh người đại diện để đạt Tier 2. Xác minh đại diện/OTP consent không tự động là chữ ký cho nội dung clinical; signer capacity và evidence theo [[0008-ranh-gioi-tuan-thu-ky-xac-nhan-va-dinh-danh-dien-tu|ADR-0008]].
- Xác minh `PatientIdentifier`/`ElectronicIdentityLink` tách khỏi xác minh quyền đại diện; không suy ra quyền delegated access chỉ từ identifier match.
- Evidence binary lưu private object storage; DB lưu storage key, checksum, media type, size, uploader/reviewer, hiệu lực và kết quả. Download dùng URL ngắn hạn và có audit.
- Patient phone nullable; contact/login canonical nằm ở UserAccount/PatientAccountLink.

## Alternatives rejected

- Role name kiểm tra trực tiếp trong code: không biểu diễn scope/khoa/thời gian.
- Doctor table riêng: tạo hai identity chuyên môn.
- Evidence binary/OTP secret trong JSON: rủi ro privacy, scan và retention.

## Qualification

ADR này được [[0008-ranh-gioi-tuan-thu-ky-xac-nhan-va-dinh-danh-dien-tu|ADR-0008]] qualified về signer capacity, identifier/electronic-identity verification, attestation evidence và audit/break-glass metadata. ADR-0008 còn `PROPOSED`, nên các phần đó chưa là production contract đã khóa.

## Consequences

- Chính sách retention pháp lý phải được owner privacy duyệt trước production/dependent release.
- Người gán role không tự cấp quyền vượt thẩm quyền; proposer không được approve cùng financial request.
- Mọi endpoint clinical phải có negative authorization tests.

## Links

- [[../07-phan-quyen|Phân quyền]]
- [[../06-ho-so-suc-khoe-va-kham|Dependent]]
- [[../21-schema-vat-ly-mvp|Schema vật lý]]
