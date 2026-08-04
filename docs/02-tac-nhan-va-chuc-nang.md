---
aliases:
  - Tác nhân và chức năng
tags:
  - do-an/tac-nhan
source_sections:
  - 3
  - 12
---
# Tác nhân và chức năng

<!-- obsidian-nav:start -->
[[01-tong-quan-va-pham-vi|Phần trước]] · [[docs|Mục lục]] · [[03-so-do-luong-nghiep-vu|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 3. Tác nhân và principal canonical

### 3.1. Bệnh nhân/người đại diện

Đặt lịch theo ca, thanh toán, theo dõi lịch/số chờ, hồ sơ và Result đã công bố. Release 1 dùng staff-assisted CheckIn; self check-in web để release sau. Người bệnh/người đại diện có thể ký hoặc xác nhận nội dung liên quan khi signer capacity, PatientAccountLink, scope, hiệu lực và phương thức tại [[adr/0008-ranh-gioi-tuan-thu-ky-xac-nhan-va-dinh-danh-dien-tu|ADR-0008]] cho phép.

### 3.2. Practitioner và PractitionerRole

`Practitioner` là nhân sự chuyên môn canonical. Bác sĩ không có identity/table riêng mà mang PractitionerRole `DOCTOR`. Một Practitioner có thể có nhiều role theo Department và thời gian hiệu lực:

- `DOCTOR`: Encounter, Diagnosis, Prescription, Episode, Referral và Order.
- `TECHNICIAN`: nhập Result PRELIMINARY theo loại Order.
- `LAB_APPROVER`: ký Result laboratory FINAL.
- `RADIOLOGIST`: ký Result imaging FINAL.
- `CARE_COORDINATOR`: hỗ trợ CareTeam/Referral theo permission.

Role chuyên môn không tự cấp quyền; authorization còn kiểm tra permission, Department, quan hệ điều trị và thời gian.

### 3.3. Nhân viên vận hành

- `RECEPTIONIST`: Patient/dependent hành chính, Appointment, staff CheckIn và Visit.
- `QUEUE_COORDINATOR`: QueueEntry, gọi số, QueueAdjustment.
- `CASHIER`: Payment, Allocation, ChargeItem và đề xuất financial adjustment.
- `FINANCE_APPROVER`: duyệt refund/reversal; không được là proposer cùng request.
- `SECURITY_AUDITOR`: xem audit/break-glass theo phạm vi.
- Nhân viên nội trú: Admission/Bed/Discharge sau MVP.

### 3.4. Admin

Admin cấu hình catalog, ca, role/permission, policy và hệ thống. Admin không mặc định xem/sửa chuyên môn, ký Result hoặc duyệt nghiệp vụ lâm sàng. Quyền chuyên môn chỉ đến từ PractitionerRole và permission có hiệu lực.

### 3.5. Records, compliance và hạ tầng

- `CLINICAL_RECORDS_MANAGER`: quản lý completeness, retention, truy xuất và chuyển đổi hồ sơ; không mặc định sửa/ký clinical content.
- `COMPLIANCE_REVIEWER`: quản lý applicability/evidence/approval; không tự cấp clinical permission.
- `INFRASTRUCTURE_OPERATOR`: vận hành backup/restore/hạ tầng; không mặc định đọc clinical payload.

### 3.6. System/provider actor

Job, webhook và integration dùng actor type `SYSTEM`, `PAYMENT_PROVIDER`, `IDENTITY_PROVIDER` hoặc `ATTESTATION_PROVIDER`, correlation ID và source ID. Không giả mạo UserAccount để ghi audit.

---

## 12. Chức năng theo tác nhân

| Capability | Actor chính | Guard bắt buộc |
|---|---|---|
| Quản lý profile/dependent | Patient/Representative, Receptionist | Link scope + verification tier |
| Tạo SlotHold/Appointment | Patient/Representative, Receptionist | Patient scope + capacity + payment policy |
| CheckIn/Visit | Receptionist | `checkin.execute`, cửa sổ hoặc exception reason |
| Queue/gọi số | QueueCoordinator | Department scope |
| QueueAdjustment | QueueCoordinator | `queue.adjust`, reason + before/after audit |
| Ghi Encounter/Diagnosis/Prescription draft | Doctor | Treatment relationship + Department + write permission |
| Ký/xác nhận clinical content | Practitioner, Patient/Representative theo mapping | Signer capacity + method + valid attestation |
| Amend/publish clinical version | Authorized actor | Quyền riêng + version/state guards |
| Episode/CareTeam/Referral | Doctor/CareCoordinator | Role và permission theo resource |
| Tạo/ký Order | Doctor | `order.create` + `order.sign` theo Order type |
| Nhập PRELIMINARY laboratory | Technician/Practitioner | `result.author.lab` |
| Nhập PRELIMINARY imaging | Technician/Radiologist | `result.author.imaging` |
| Ký FINAL laboratory | LabApprover | `result.finalize.lab` + effective role |
| Ký FINAL imaging | Radiologist | `result.finalize.imaging` + effective role |
| Thu tiền | Cashier | `payment.capture` |
| Đề xuất refund/reversal | Cashier | `financial.adjust.propose` |
| Duyệt refund/reversal | FinanceApprover | `financial.adjust.approve`, khác proposer |
| Xác minh identifier/electronic identity link | Authorized identity staff/system | `identity.link.verify` + source/evidence |
| Truy xuất/xuất hồ sơ | ClinicalRecordsManager/authorized requester | `record.export` + purpose + approval + audit |
| Chuyển đổi hồ sơ giấy | Records operator/reviewer | `legacy_record.convert/review` + quyết định/batch |
| Break-glass | Doctor | Patient scope + purpose + TTL + review |
| Xem audit | SecurityAuditor/authorized manager | Audit scope riêng |

Permission action và schema actor được khóa tại [[07-phan-quyen|Phân quyền]], [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] và [[21-schema-vat-ly-mvp|Schema vật lý]].

---

<!-- related-links:start -->
## Liên kết liên quan

- [[07-phan-quyen|Phân quyền]]
- [[14-gia-dinh-cau-hoi-va-dinh-huong#22.1. Quyết định đã chốt|Sổ quyết định]]
- [[20-so-quyet-dinh-kien-truc|Kiến trúc]]
<!-- related-links:end -->
