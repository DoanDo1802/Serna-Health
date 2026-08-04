---
aliases:
  - Dashboard quản lý
tags:
  - do-an/bao-cao
source_sections:
  - 13
---
# Dashboard quản lý

<!-- obsidian-nav:start -->
[[07-phan-quyen|Phần trước]] · [[docs|Mục lục]] · [[09-ngoai-le-va-quy-tac-nghiep-vu|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 13. Dashboard quản lý

### 13.1. KPI tổng quan

- SlotHold ACTIVE/CONSUMED/EXPIRED và tỷ lệ chuyển thành Appointment.
- Công suất bốn ca, số chỗ trống và no-show theo bác sĩ/ca.
- Check-in đúng hạn, check-in ngoại lệ, thời gian chờ và hàng tồn.
- Số QueueAdjustment và lý do điều chỉnh.
- Appointment, Visit, Encounter và Episode theo trạng thái riêng.
- Referral accepted/rejected/completed.
- Order theo loại; thời gian đến Result FINAL.
- ChargeItem, Payment, Refund, số dư BillingAccount và refund quá SLA 3–7 ngày làm việc.
- Waiting list giường khi module nội trú được bật.

### 13.2. Biểu đồ đề xuất

- Conversion SlotHold → Appointment.
- Công suất và tỷ lệ lấp đầy 4 ca/ngày.
- Thời gian chờ, hàng tồn và tỷ lệ xen ca.
- Visit đa chuyên khoa, Episode và Referral.
- Thời gian Order → FINAL.
- Doanh thu/Refund/ChargeItem.

### 13.3. Bộ lọc

Ngày, bác sĩ, khoa, ca sáng/chiều, resource, trạng thái, loại Order, phương thức tiền mặt/QR và dependent/chính chủ khi được phép.

### 13.4. Nguyên tắc số liệu

- Không suy Visit từ Appointment hoặc Encounter từ Visit.
- Không đếm nhiều Encounter thành nhiều Patient.
- QueueAdjustment không sửa checked_in_at gốc.
- Doanh thu dựa Payment/Refund; phải thu dựa ChargeItem.
- Dashboard không lộ dữ liệu định danh/chuyên môn ngoài quyền.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[04-vong-doi-va-nghiep-vu-lich-kham|Ca và queue]]
- [[05-thanh-toan-va-doanh-thu|Tài chính]]
- [[14-gia-dinh-cau-hoi-va-dinh-huong#22.1. Quyết định đã chốt|Quyết định]]
<!-- related-links:end -->
