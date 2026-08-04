---
aliases:
  - ADR-0012 Technical finalization và lawful signing boundary
artifact_type: adr
status: ACCEPTED
date: 2026-08-04
decision_ids:
  - CLIN-01
  - CLIN-02
  - CLIN-04
  - SIGN-01
---
# ADR-0012 — Technical finalization và lawful signing boundary

## Context

Release 1 chỉ yêu cầu technical immutability nhưng state/action hiện dùng `SIGNED`/`sign`, dễ bị hiểu thành chữ ký điện tử hợp pháp dù `SIGN-01` và ADR-0008 chưa được duyệt.

## Decision

- Release 1 dùng state `FINALIZED` cho immutable technical record. `DRAFT → FINALIZED` dùng action `clinical.note.finalize` hoặc `diagnosis.finalize`.
- Finalization lưu author, finalizer, `finalized_at`, canonical content digest/digest algorithm và provenance. Không tạo `ElectronicAttestation` và không được trình bày là lawful signing.
- `SIGNED` chỉ active trong lawful-signing tranche khi target version có valid `ElectronicAttestation` theo signer/content/method matrix đã duyệt. `*.sign` và `*.publish` không active cho R1 technical-only workflow.
- FINALIZED version không update payload. Amendment tạo version DRAFT mới với previous version, reason, actor/time; bản cũ giữ nguyên. `ENTERED_IN_ERROR` không xóa history.
- API/UI dùng “đã hoàn tất kỹ thuật” cho FINALIZED. Không dùng nhãn “đã ký”, “ký số” hoặc “hợp pháp” khi chưa có attestation hợp lệ.

## Compatibility

- Tài liệu/schema chưa triển khai nên đổi canonical trực tiếp từ technical `SIGNED` sang `FINALIZED`; không cần data migration R1.
- Diagnostics/Prescription và lawful signing release sau vẫn có thể dùng SIGNED nếu ADR-0008 được ACCEPTED và `SIGN-01` đóng.
- Existing acceptance có từ “signed” phải phân loại: technical R1 đổi FINALIZED; legal/diagnostics giữ gated wording.

## Alternatives rejected

- Giữ `SIGNED` rồi thêm tooltip: state/API vẫn mang nghĩa nhập nhằng và dễ tạo legal claim sai.
- Tạo fake `INTERNAL_PROVENANCE` attestation: làm lẫn provenance với evidence ký, trái fail-closed boundary.
- Chặn toàn bộ clinical R1 đến khi legal signing xong: không cần thiết cho technical versioning/immutability.

## Consequences

- Permission matrix tách finalize/sign/publish.
- ClinicalNote/Diagnosis R1 schema dùng `finalized_at`, `finalizer_role_id`, digest fields; không FK ElectronicAttestation.
- `SIGN-01`, ADR-0008 và R1-10L tiếp tục BLOCKED; technical R1-10 có thể triển khai độc lập.

## Links

- [[0007-clinical-record-va-result-versioning|ADR-0007 — Clinical record và Result versioning]]
- [[0008-ranh-gioi-tuan-thu-ky-xac-nhan-va-dinh-danh-dien-tu|ADR-0008 — PROPOSED]]
- [[../schema/reception-clinical-r1|Schema reception/clinical R1]]
- [[../13-ke-hoach-va-nghiem-thu-mvp#Release 1 clinical/billing|Acceptance clinical]]
