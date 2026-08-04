---
aliases:
  - ADR-0007 Clinical record và Result versioning
artifact_type: adr
status: ACCEPTED
date: 2026-07-30
decision_ids:
  - CLIN-01
  - CLIN-02
  - ORD-05
  - ORD-06
  - ORD-07
---
# ADR-0007 — Clinical record và Result versioning

## Context

ClinicalNote/Diagnosis thuộc MVP nhưng chưa canonical. Result mới có metadata, gộp author/finalizer và cho amend/correct không có bước ký lại.

## Decision

- ClinicalNote có identity và immutable versions. Version `DRAFT` được sửa; `SIGNED` không ghi đè. Amendment tạo version mới có reason/previous version. `SIGNED` là business state; bằng chứng ký/xác nhận điện tử cần attestation theo [[0008-ranh-gioi-tuan-thu-ky-xac-nhan-va-dinh-danh-dien-tu|ADR-0008]].
- Diagnosis có identity/version, Encounter, code system/code/display tùy chọn, free text, diagnosis type, clinical status, author và provenance. Không ép ICD-10 cho mọi record trong Release 1.
- ClinicalResult tách identity và immutable version. Version có `payload jsonb`, `payload_schema_version`, narrative, author, finalizer, signed/published timestamps và previous version.
- Laboratory payload hỗ trợ structured items qua schema version và narrative; imaging hỗ trợ findings, impression, narrative và attachment metadata. Specimen/PACS không thuộc MVP.
- Author và finalizer là hai relationship riêng. PRELIMINARY cần author; FINAL cần finalizer có permission theo Order type.
- LAB finalizer tối thiểu `LAB_APPROVER`; imaging finalizer `RADIOLOGIST`. KTV không mặc định ký.
- Sign và publish là hai hành vi riêng. Amend/correct tạo draft version mới, ký/xác nhận lại rồi mới publish; bệnh nhân chỉ xem latest attested, signed và published version.
- Order, Prescription và attachment relationship phải giữ version/provenance; attestation nhắm đúng target version/digest, không chỉ resource identity.
- Critical Result workflow vẫn `OPEN-ORD-02`. Diagnostics tranche không được nhận critical test trong catalog trước khi đóng workflow này.

## Alternatives rejected

- Một text field ghi đè: mất provenance/version.
- Một relationship Practitioner chung: không phân biệt author/finalizer.
- Chuyển thẳng FINAL sang CORRECTED: có thể công bố bản chưa ký.

## Qualification

Release 1 technical-only dùng `FINALIZED`, không dùng `SIGNED`, theo [[0012-technical-finalization-va-lawful-signing-boundary|ADR-0012]]. ADR này được [[0008-ranh-gioi-tuan-thu-ky-xac-nhan-va-dinh-danh-dien-tu|ADR-0008]] qualified về ý nghĩa pháp lý của `SIGNED`, signer capacity, phương thức/evidence ký và transition sign/publish. Immutability/versioning vẫn `ACCEPTED`; lawful signing còn bị chặn bởi `SIGN-01` khi ADR-0008 chưa được duyệt.

## Consequences

- Payload phải validate theo `order_type + schema_version`.
- Signed payload bất biến; attachment reference cũng thuộc version.
- Sequence diagram signer phải dùng authorized practitioner, không dùng Admin mặc định.

## Links

- [[../06-ho-so-suc-khoe-va-kham|Hồ sơ]]
- [[../16-orders-va-results|Orders và Results]]
- [[../21-schema-vat-ly-mvp|Schema vật lý]]
