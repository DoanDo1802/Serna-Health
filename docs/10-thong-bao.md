---
aliases:
  - Thông báo
tags:
  - do-an/nghiep-vu
source_sections:
  - 15
---
# Thông báo

<!-- obsidian-nav:start -->
[[09-ngoai-le-va-quy-tac-nghiep-vu|Phần trước]] · [[docs|Mục lục]] · [[11-mo-hinh-du-lieu|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 15. Thông báo

### 15.1. Kênh

Trung tâm thông báo trong web responsive và email. Màn hình gọi số hiển thị QueueEntry/phòng; không hiển thị dữ liệu nhạy cảm.

### 15.2. Sự kiện cần thông báo

- Appointment CONFIRMED, đổi, hủy; nhắc trước 24 giờ.
- Cọc thất bại/đang xác minh; refund được duyệt và dự kiến 3–7 ngày làm việc.
- Check-in thành công, số chờ và thay đổi phòng.
- Referral requested/accepted/rejected; từ chối kèm lý do phù hợp.
- Result FINAL sẵn sàng; AMENDED/CORRECTED được thông báo lại.
- Dependent cần bổ sung xác minh hoặc đã VERIFIED.
- Admission waiting list/được tiếp nhận/Discharge khi module nội trú hoạt động.

### 15.3. Nội dung và độ tin cậy

- Email không chứa ClinicalNote, Diagnosis hoặc Result chi tiết.
- Gửi bất đồng bộ, retry có giới hạn và idempotent.
- Lưu resource ID, template version, trạng thái và thời gian gửi.
- Không gửi Result PRELIMINARY cho bệnh nhân.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[04-vong-doi-va-nghiep-vu-lich-kham|Appointment/queue]]
- [[06-ho-so-suc-khoe-va-kham|Dependent/Result]]
- [[12-yeu-cau-phi-chuc-nang#18.3. Sẵn sàng, hạ tầng và khôi phục|Độ tin cậy]]
<!-- related-links:end -->
