---
aliases:
  - ADR-0008 Ranh giới tuân thủ, ký xác nhận và định danh điện tử
artifact_type: adr
status: PROPOSED
date: 2026-07-31
decision_ids:
  - REG-01
  - IDN-01
  - IDN-02
  - SIGN-01
  - OPS-01
  - TRANS-01
---
# ADR-0008 — Ranh giới tuân thủ, ký/xác nhận và định danh điện tử

## Context

TT13/2025/TT-BYT yêu cầu HSBA được lập, cập nhật, hiển thị, ký, lưu trữ, quản lý, sử dụng và khai thác điện tử; kết nối số định danh cá nhân; có hạ tầng/phục hồi/truy xuất; hỗ trợ ký hoặc xác nhận của NVYT, người bệnh hoặc đại diện; cơ sở phải ban hành quy chế.

Contract hiện có dùng state `SIGNED` và câu “application attestation trong MVP” nhưng chưa mô hình hóa phương thức pháp lý, signer capacity, target digest, verification evidence hoặc revoke. `Patient` chỉ có UUID/demographics, chưa có identifier/link điện tử tách biệt. Product docs cũng chưa tách technical readiness khỏi facility compliance.

## Decision đề xuất

### 1. Ranh giới tuyên bố

- Product docs mô tả capability và design evidence; không chứng nhận cơ sở đã tuân thủ.
- Ba mức độc lập: documented design, implemented/tested capability, facility operational compliance.
- Phase/Release `GO` chỉ có nghĩa ghi rõ trong gate. Technical GO không suy ra production/legal GO.
- Compliance status theo từng requirement tại [[../23-ma-tran-yeu-cau-tt13-2025|matrix]], không dùng một phần trăm docs để kết luận chung.

### 2. Domain state và attestation

- `SIGNED` là business state. Version chỉ được coi đã có bằng chứng ký/xác nhận khi liên kết `ElectronicAttestation` hợp lệ.
- `ElectronicAttestation` append-only nhắm đúng `target_resource_type`, `target_resource_id`, `target_version_id`, `target_digest` và `digest_algorithm`.
- Lưu signer actor/capacity, method, verifier/provider reference, credential/certificate metadata khi áp dụng, validation outcome, signed/confirmed time, evidence metadata, correlation ID và revoke/error status.
- Sign và publish là transition/permission riêng. Publication không tạo attestation thay signer.
- Amendment/correction tạo target version và attestation mới; không tái sử dụng chữ ký của version cũ.

### 3. Phương thức Điều 3

Method class:

- `LEGAL_ELECTRONIC_SIGNATURE` — chữ ký điện tử hợp pháp.
- `BIOMETRIC_CONFIRMATION` — kỹ thuật sinh trắc học.
- `OTHER_ELECTRONIC_CONFIRMATION` — hình thức khác được Legal Owner chấp nhận theo khoản 4 Điều 22 Luật Giao dịch điện tử.
- `INTERNAL_PROVENANCE` — xác nhận provenance nội bộ; không được trình bày là phương thức hợp pháp nếu chưa được phân loại/phê duyệt.

Mỗi deployment phải có signer/content/method matrix được Clinical, Legal và Security phê duyệt. Không fallback im lặng giữa các method class.

### 4. Dữ liệu nhạy cảm của phương thức ký

- Không lưu private key, OTP secret, raw biometric sample hoặc reusable biometric template trong clinical payload, attestation hoặc audit.
- Chỉ lưu kết quả xác minh, assurance/method, provider reference và evidence metadata cần thiết theo retention policy.
- Biometric workflow cần privacy impact assessment, liveness/match/fallback policy và access control riêng trước khi chọn.

### 5. Signer capacity

Signer có thể là:

- Practitioner qua `PractitionerRole` có hiệu lực và permission;
- Patient;
- Representative có `PatientAccountLink`/căn cứ đại diện, scope và hiệu lực phù hợp;
- actor khác chỉ khi mapping pháp lý/chuyên môn cho phép.

Dependent verification/OTP consent không tự động là chữ ký cho clinical content. Capacity được snapshot tại thời điểm ký và giữ trong attestation evidence.

### 6. Định danh cá nhân

- UUID `Patient.id` vẫn là khóa nội bộ; số định danh cá nhân không làm PK và không dùng trực tiếp làm login key.
- `PatientIdentifier` lưu type, issuer, jurisdiction, protected value/token, status, verification source, verified time và effective/revoked interval.
- `ElectronicIdentityLink` lưu external system/subject reference, link status, assurance, linked/verified/revoked timestamps và evidence reference.
- Duplicate resolution, identifier mismatch, reuse, revoke và foreign-person workflow cần explicit review/audit.
- Không tuyên bố tích hợp một tài khoản định danh cụ thể trước khi adapter, legal basis, data-sharing agreement và conformance tests được duyệt.

### 7. Phân vai và evidence

- Module sở hữu resource điều phối signing transition; `identity-access` cung cấp verification port/policy; `platform-audit` giữ audit/evidence index.
- Cơ sở KCB chịu trách nhiệm applicability, phương thức được phép, quy chế, hạ tầng, đào tạo, go-live và bằng chứng vận hành.
- Khung quy chế tại [[../24-khung-quy-che-van-hanh-hsba-dien-tu|file 24]] giữ `DRAFT` đến khi được ban hành đúng thẩm quyền.

## Alternatives rejected

- Coi `status=SIGNED` hoặc `signed_at` là đủ: không có phương thức, signer capacity, target digest hoặc verification evidence.
- Ép PKI duy nhất: TT13 cho ba nhóm hình thức và deployment cần quyết định có thẩm quyền.
- Lưu raw biometric/secret để “làm bằng chứng”: tăng rủi ro và không cần thiết cho domain record.
- Dùng số định danh cá nhân làm Patient PK: khóa ngoại bộ, khó revoke/correction và làm lộ dữ liệu.
- Tuyên bố tuân thủ từ schema/Markdown: bỏ qua vận hành, phê duyệt và evidence.

## Consequences

- ADR này còn `PROPOSED`; `SIGN-01`, `IDN-02` và `REG-01` chặn legal production claim. `IDN-01` chỉ đủ cho thu thập identifier Release 1, không thay electronic identity linkage.
- ADR-0004 được qualified về signer capacity, identifier verification, break-glass/audit evidence.
- ADR-0007 được qualified: immutability vẫn `ACCEPTED`, nhưng ý nghĩa ký hợp pháp cần attestation theo ADR này.
- Schema cần `patient_identifier`, `electronic_identity_link`, `electronic_attestation` và audit/break-glass fields mở rộng.
- Backlog tách technical versioning khỏi lawful signing/confirmation.

## Approval required

Trước khi chuyển `ACCEPTED`:

- Legal xác nhận Điều 3, khoản 4 Điều 22 Luật Giao dịch điện tử, data-sharing/identity basis.
- Clinical Records xác nhận signer/content matrix từ Chương X TT32.
- Security/Privacy xác nhận evidence, cryptographic/biometric handling, retention và revoke.
- Architecture xác nhận module/schema/provider ports.
- Facility owner xác nhận applicability và operational policy path.

## Links

- [[../23-ma-tran-yeu-cau-tt13-2025|Ma trận TT13]]
- [[../24-khung-quy-che-van-hanh-hsba-dien-tu|Khung quy chế]]
- [[0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]]
- [[0007-clinical-record-va-result-versioning|ADR-0007]]
- [[../21-schema-vat-ly-mvp|Schema vật lý]]
