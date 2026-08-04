---
aliases:
  - Tổng quan và phạm vi
tags:
  - do-an/tong-quan
source_sections:
  - 1
  - 2
---
# Tổng quan và phạm vi

<!-- obsidian-nav:start -->
[[docs|Mục lục]] · [[02-tac-nhan-va-chuc-nang|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 1. Tổng quan dự án

### 1.1. Tên đề xuất

**MediCore — Hệ thống quản lý quy trình chăm sóc và khám bệnh tại bệnh viện**

### 1.2. Bối cảnh

Hệ thống số hóa lập kế hoạch, tiếp nhận, khám đa chuyên khoa và chăm sóc liên tục. Mô hình phân biệt SlotHold, Appointment, Visit, Encounter và EpisodeOfCare.

### 1.3. Mục tiêu

- Bệnh nhân chọn ca, đặt cọc QR, check-in, theo dõi hàng chờ/timeline và quản lý dependent online.
- Bác sĩ/CareTeam quản lý Encounter, Episode, Referral, Order và Result.
- Nhân viên điều phối bốn ca/ngày, queue, billing và xác minh hồ sơ.
- Admin/Quản lý cấu hình nguồn lực, theo dõi KPI/audit và phê duyệt nghiệp vụ tài chính.

---

## 2. Phạm vi đã thống nhất

| Hạng mục | MVP |
|---|---|
| Nền tảng | Web responsive trên cloud |
| Quy mô mục tiêu | Khoảng 1.000 Visit/ngày |
| Ca khám | Tối đa 4 ca/bác sĩ/ngày; 2 sáng, 2 chiều |
| Đặt lịch | SlotHold 5 phút; cọc min(100.000 VNĐ, giá dự kiến) |
| Check-in | Mở trước 60 phút, đóng trước kết thúc ca 30 phút |
| Hàng chờ | Theo checked_in_at, có màn hình gọi số và điều chỉnh audit |
| Khám | Visit ngoại trú đa Encounter/chuyên khoa |
| Chăm sóc liên tục | Episode, CareTeam riêng, Referral nội bộ |
| Order/Result | Xét nghiệm và hình ảnh; PRELIMINARY/FINAL |
| Hồ sơ | Dependent online, hậu kiểm 30 ngày, break-glass |
| Tài chính | BillingAccount theo Visit, tiền mặt/QR, refund hai bước |

### 2.1. Ngoài phạm vi MVP

- Kiosk tự check-in/mobile native.
- Specimen/barcode, LIS/PACS, thiết bị và thủ thuật đầy đủ.
- Nội trú/giường/điều dưỡng/y lệnh hoàn chỉnh.
- Tách account dependent, gộp/tách Episode nâng cao.
- Bảo hiểm/BHYT, nhiều bên chi trả, hóa đơn điện tử.
- Tích hợp HIS/LIS/PACS/FHIR ngoài.

### 2.2. Mô hình chăm sóc mục tiêu

```text
PatientAccount → Patient/dependent
Patient → SlotHold → Appointment
Patient → Visit → Encounter
Encounter ↔ EpisodeOfCare → CareTeam
Visit → BillingAccount → ChargeItem/Payment
```

### 2.3. Nguyên tắc phân kỳ

Nội trú và tích hợp ngoài được thiết kế điểm mở rộng nhưng chưa cam kết UI/workflow đầy đủ trong MVP.

### 2.4. Ranh giới pháp lý và triển khai

- Product scope: capability MediCore mô tả và sẽ phát triển theo release.
- Deployment scope: cấu hình/hạ tầng/provider/dữ liệu thực tế của từng cơ sở.
- Facility compliance scope: nghĩa vụ pháp lý, quy chế ban hành, đào tạo, evidence vận hành và phê duyệt của cơ sở khám bệnh, chữa bệnh.

Release 1 chỉ là thin technical slice; không đại diện toàn bộ HSBA điện tử của bệnh viện. Nội trú đang deferred trong product scope nhưng có thể vẫn thuộc nghĩa vụ cơ sở nếu giấy phép/phạm vi điều trị yêu cầu. Lộ trình TT13 phụ thuộc phân loại cơ sở tại [[23-ma-tran-yeu-cau-tt13-2025#5. Ma trận Điều 4 — hiệu lực và lộ trình|matrix Điều 4]], không tự kết luận từ docs này.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[docs#Thuật ngữ chuẩn|Thuật ngữ]]
- [[13-ke-hoach-va-nghiem-thu-mvp|MVP]]
- [[14-gia-dinh-cau-hoi-va-dinh-huong#22.1. Quyết định đã chốt|Quyết định]]
- [[23-ma-tran-yeu-cau-tt13-2025|Ma trận TT13]]
<!-- related-links:end -->
