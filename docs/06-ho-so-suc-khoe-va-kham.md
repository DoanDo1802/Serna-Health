---
aliases:
  - Hồ sơ sức khỏe và khám
tags:
  - do-an/ho-so
source_sections:
  - 10
---
# Hồ sơ sức khỏe và khám

<!-- obsidian-nav:start -->
[[05-thanh-toan-va-doanh-thu|Phần trước]] · [[docs|Mục lục]] · [[07-phan-quyen|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 10. Hồ sơ sức khỏe và hồ sơ khám

### 10.1. Hồ sơ hành chính bệnh nhân

Patient Profile tối thiểu:

- Họ và tên.
- Ngày sinh.
- Ít nhất một contact hợp lệ từ UserAccount/PatientAccountLink hoặc Patient nếu có.

`Patient.phone` nullable vì trẻ em/người phụ thuộc có thể dùng contact người đại diện. Phone và số định danh cá nhân không là khóa Patient. Giới tính khai báo, email, địa chỉ và emergency contact là thuộc tính hành chính; identifier/link điện tử dùng contract riêng:

- `PatientIdentifier`: type, issuer, jurisdiction, protected value/token, status, verification source, verified time, effective/revoked interval.
- `ElectronicIdentityLink`: external system/subject reference, assurance, link status, linked/verified/revoked timestamps và evidence reference.
- Giá trị đầy đủ được mã hóa/tokenize, quyền đọc riêng và audit; không dùng trực tiếp làm login identifier.
- Mismatch/reuse/revoke/foreign-person workflow cần review; duplicate detection không auto-merge theo họ tên/ngày sinh/phone/identifier.

MVP chưa có kênh định danh điện tử được cấp phép thì vẫn thu thập CCCD/số định danh cá nhân hoặc hộ chiếu để chuẩn bị đối soát sau:

- Người dùng tự nhập: `SELF_DECLARED`.
- Nhân viên nhập hộ: `STAFF_RECORDED`.
- Nhân viên đã xem giấy tờ bản gốc/ảnh evidence: `MANUALLY_VERIFIED`.
- Chỉ khi gọi provider/kênh được duyệt và match đạt mới là `ELECTRONICALLY_VERIFIED` và có thể tạo `ElectronicIdentityLink` active.

`SELF_DECLARED`, `STAFF_RECORDED` và `MANUALLY_VERIFIED` giúp deduplicate, tiếp nhận và chuẩn bị đồng bộ sau; không được xem là hoàn thành TT13 Điều 1.3. Chi tiết: `IDN-01` cho thu thập/bảo vệ định danh MVP, `IDN-02` cho kết nối điện tử production, [[adr/0008-ranh-gioi-tuan-thu-ky-xac-nhan-va-dinh-danh-dien-tu|ADR-0008]].

### 10.2. Dependent và verification tiers

Một account quản lý nhiều Patient qua PatientAccountLink.

| Tier | Trạng thái | Quyền tối đa mặc định |
|---|---|---|
| Tier 0 | `PENDING` | Demographics tối thiểu, booking, payment, queue |
| Tier 1 | `IDENTITY_VERIFIED` | Hành chính Visit và billing; chưa xem clinical content |
| Tier 2 | `REPRESENTATION_VERIFIED` | Clinical read theo permission scope |

- Trẻ em: giấy khai sinh + xác minh người đại diện để đạt Tier 2.
- Người lớn: OTP consent hoặc ủy quyền hợp lệ để đạt Tier 2.
- Link có scope, hiệu lực, expiry, revoke và lịch sử; deny-by-default.
- Scope tối thiểu tách: demographics, appointment, payment, queue, visit administration, episode, prescription, result, note, diagnosis, attachment.
- Binary evidence ở private object storage. DB chỉ lưu storage key, checksum, MIME, size, uploader/reviewer, hiệu lực và result; mọi download có audit.
- Retention/deletion pháp lý phải được Privacy Owner duyệt trước dependent tranche production.

### 10.3. Thông tin sức khỏe nền

Thông tin nền dùng `HealthBaselineEntry` identity và immutable `HealthBaselineVersion`. Category thiết kế tối thiểu: `BLOOD_GROUP`, `ALLERGY`, `CONDITION`, `CURRENT_MEDICATION`, `PROCEDURE_OR_SURGICAL_HISTORY`, `IMPORTANT_NOTE`.

Mỗi version có coded value hoặc narrative, source (`PATIENT_REPORTED`, `REPRESENTATIVE_REPORTED`, `CLINICIAN_ENTERED`, `IMPORTED`), author, verification status/verifier/time, effective interval và provenance. Dữ liệu do người bệnh/đại diện khai báo không được dùng như clinically verified nếu chưa có xác nhận chuyên môn.

Đây là baseline thiết kế `CLIN-03`, chưa phải danh sách đầy đủ theo Chương X TT32. Chỉ field có mapping tại [[23-ma-tran-yeu-cau-tt13-2025#9. Sub-matrix Chương X TT32/2023/TT-BYT|sub-matrix TT32]] mới được gọi là bắt buộc pháp lý.

### 10.4. ClinicalNote và Diagnosis

`ClinicalNote` có identity và immutable versions:

- Version `DRAFT` được author sửa.
- Release 1 chuyển `DRAFT → FINALIZED` bằng permission finalize; lưu finalizer, time và canonical digest. `FINALIZED` bất biến và chỉ có nghĩa hoàn tất kỹ thuật, không phải chữ ký điện tử hợp pháp.
- `SIGNED` chỉ active ở lawful-signing tranche khi có `ElectronicAttestation` hợp lệ nhắm đúng version/digest và `SIGN-01` đã đóng.
- Amendment tạo version DRAFT mới, tham chiếu previous version, bắt buộc reason/actor/time; bản FINALIZED cũ không đổi. Lawful tranche cần attestation mới khi nội dung cần ký/xác nhận.
- `ENTERED_IN_ERROR` không xóa lịch sử.

`Diagnosis` có Encounter, author, type, clinical status, code system/code/display tùy chọn và free text. Release 1 không ép ICD-10 cho mọi diagnosis; coding policy có thể nâng cấp mà không đổi identity/version contract.

### 10.5. Hồ sơ Encounter và timeline

Encounter liên kết Visit; Patient được suy ra canonical qua Visit và kiểm tra invariant cùng Patient với Episode. Hồ sơ gồm participants, Department/Room, ClinicalNote, Diagnosis, Prescription header/items, Order/Result references, HealthBaseline references, ClinicalAttachment và provenance.

`ClinicalAttachment` chỉ lưu metadata/checksum/storage reference; binary ở private object storage. `ClinicalAttachmentLink` nhắm đúng owner resource/version, ghi uploader/authorizer, media type/size/scan status và mọi access/download có audit.

Timeline hiển thị Episode, CareTeam, Visit, Encounter, Referral, Order, latest signed Result và kế hoạch tiếp theo theo authorization tại thời điểm đọc.

### 10.6. Result visibility

- KTV/authorized author nhập PRELIMINARY.
- Authorized finalizer theo Order type ký/xác nhận FINAL bằng phương thức được phê duyệt.
- Sign và publish tách riêng; chỉ publish khi target version có attestation hợp lệ nếu mapping yêu cầu.
- Bệnh nhân/người đại diện chỉ xem latest attested, signed và published version khi scope cho phép.
- AMENDED/CORRECTED tạo version mới và attestation mới trước publish; bản cũ giữ nguyên.

### 10.7. Prescription

Prescription là header theo Encounter/prescriber/date/status và có một hoặc nhiều `PrescriptionItem`. Item gồm diagnosis reference/summary, medication code system/code/display hoặc narrative, hàm lượng/đơn vị, liều, đường dùng, tần suất, số lượng/thời gian và hướng dẫn. Extension JSON phải có schema version, không thay các trường tối thiểu. Prescription cần attestation khi signer/content matrix yêu cầu. MVP chưa quản lý kho/cấp phát.

### 10.8. Quan hệ điều trị, hậu kiểm và break-glass

- Treatment relationship đến từ Encounter participant, CareTeam assignment hoặc ResponsibleDoctorAssignment có hiệu lực.
- Khi quan hệ cuối cùng kết thúc, quyền hậu kiểm read/amend theo permission kéo dài 30 ngày.
- Sau 30 ngày, default deny; approval workflow riêng nếu policy cho phép.
- Break-glass có Patient scope, purpose, TTL tối đa 4 giờ, auto-expiry, alert và review trong 1 ngày làm việc.
- Mọi grant/read/amend/break-glass có audit append-only.

Chi tiết: [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]], [[adr/0007-clinical-record-va-result-versioning|ADR-0007]].

---

<!-- related-links:start -->
## Liên kết liên quan

- [[07-phan-quyen#Break-glass và hậu kiểm|Quyền hồ sơ]]
- [[11-mo-hinh-du-lieu#16.6. Hồ sơ phụ thuộc và xác minh|ERD dependent]]
- [[16-orders-va-results|Result]]
- [[21-schema-vat-ly-mvp#Patient và dependent|Schema]]
<!-- related-links:end -->
