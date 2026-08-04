---
aliases:
  - Ngoại lệ và quy tắc nghiệp vụ
tags:
  - do-an/nghiep-vu
source_sections:
  - 14
  - 17
---
# Ngoại lệ và quy tắc nghiệp vụ

<!-- obsidian-nav:start -->
[[08-dashboard-quan-ly|Phần trước]] · [[docs|Mục lục]] · [[10-thong-bao|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 14. Xử lý các trường hợp phát sinh

### 14.1. Bác sĩ nghỉ đột xuất

Giữ ca mới trước khi chuyển; reschedule tạo Appointment mới và lineage. Nếu không có ca phù hợp, bệnh viện hủy và hoàn đủ cọc. Không sửa Doctor/slot trên lịch cũ.

### 14.2. Bệnh nhân đến sau hạn check-in

Sau `slot.end_at - 30 phút`, chỉ staff có permission được CheckIn ngoại lệ; bắt buộc reason và xếp cuối hàng phù hợp. Chỉ Appointment còn CONFIRMED, chưa CheckIn/Visit khi đóng ca mới NO_SHOW.

### 14.3. Payment success nhưng webhook đến muộn

Webhook vào inbox và dedup. `provider_occurred_at` là mốc canonical: chỉ trusted time từ signed payload hợp lệ, parse có offset, trong clock-skew ±5 phút và `< expires_at` mới được xét cùng reservation. Missing/invalid/untrusted time, tại/sau `expires_at`, hoặc reservation không còn đều không tạo Appointment; Payment capture giữ `CAPTURED`, PaymentIntent chuyển `RECONCILIATION_REQUIRED` và tạo refund/đối soát. `received_at` không thay business time. Không thu lại trong lúc đang xác minh.

### 14.3.1. Authentication failure và replay

Response đăng ký/login/recovery không tiết lộ account tồn tại. OTP hết 10 phút, đã consume/revoke hoặc attempt thứ sáu bị từ chối không side effect; mã mới vô hiệu mã cũ. Năm password failure liên tiếp khóa 15 phút. Password reset/account disable/email change revoke mọi active session/token; session hoặc CSRF token replay bị từ chối và audit bằng redacted identifiers.

### 14.3.2. Reschedule funding failure

Không commit Appointment mới hoặc RESCHEDULED lịch cũ khi additional capture chưa thành công. Internal failure rollback Appointment lineage, DepositAllocation và DepositTransfer. Cọc mới thấp hơn tạo refund/reconciliation cho phần dư sau atomic transfer; external refund thất bại không đảo lineage đã commit mà retry qua outbox. Cùng idempotency key khác payload bị conflict.

### 14.4. SlotHold cạnh tranh

Transaction khóa AppointmentSlot. Tổng SlotHold ACTIVE và Appointment đang giữ reservation không vượt capacity. Retry cùng idempotency key/payload trả cùng kết quả; key khác payload bị từ chối.

### 14.5. Ca đã đủ chỗ hoặc sai cấu hình

Không tạo ca thứ năm, ca sáng/chiều thứ ba hoặc reservation vượt capacity. Ca đã có reservation không sửa giờ/capacity phá invariant; dùng version/replacement và audit.

### 14.6. Sửa ClinicalNote/Diagnosis đã FINALIZED hoặc Result đã ký

ClinicalNote/Diagnosis FINALIZED không ghi đè; tạo DRAFT version mới với reason, previous-version link và actor. FINALIZED chỉ là technical state. Result/lawful-signing amendment/correction phải được authorized finalizer ký/xác nhận lại trước publish khi gate tương ứng active.

### 14.7. CheckIn lặp

Cùng principal scope + operation + key + request hash trả cùng CheckIn/Visit/Encounter/QueueEntry. Không tạo Payment thứ hai trong CheckIn command.

### 14.8. Dependent chưa đủ tier hoặc bị revoke

Tier 0 vẫn booking/payment/queue; Tier 1 xem hành chính Visit/billing; clinical read chỉ Tier 2 theo scope. Revoke/expiry có hiệu lực với request/notification mới. Evidence access có audit.

### 14.9. Hàng chờ tồn sang ca sau

Default xen 1 tồn sau mỗi 3 bệnh nhân ca hiện tại; Department override bằng QueuePolicy versioned. QueueAdjustment lưu actor, before/after, reason; không sửa checked_in_at. Tối đa một QueueEntry active mỗi Encounter.

### 14.10. Check-in rồi bỏ về hoặc chờ quá ca

Appointment đã FULFILLED không thành NO_SHOW. `DEFERRED` vẫn active và có thể quay lại WAITING, nên chặn Visit completion. Nếu bệnh nhân rời/hủy, staff chuyển QueueEntry sang `CANCELLED` hoặc `ENTERED_IN_ERROR` với reason; terminal queue chỉ gồm `COMPLETED`, `CANCELLED`, `ENTERED_IN_ERROR`. Bệnh nhân còn chờ hợp lệ được phục vụ quá giờ ca.

### 14.11. Visit completion còn việc mở

Hard blockers: Encounter/QueueEntry chưa terminal hoặc same-day Referral pending. Order, Result, Episode hoặc billing mở là warning/follow-up. Authorized actor có thể complete với warnings; mọi override có audit.

### 14.12. Referral bị từ chối/capacity full

Nơi nhận bắt buộc reason. Same-day acceptance phải kiểm tra Department/capacity/queue; nếu không nhận được, chuyển future request hoặc reject. Không tự hủy Visit/Episode nguồn.

### 14.13. Duplicate ServiceDelivery event

Một ServiceDelivery tạo tối đa một original ChargeItem. Replay completion không tạo thêm phí. Correction dùng reversal + replacement, không sửa/xóa ChargeItem billed.

### 14.14. Refund/reversal

RefundRequest nhắm Payment; ChargeItemReversalRequest nhắm ChargeItem. Proposer khác approver. Total refund không vượt refundable amount. Ledger giữ capture gốc, tránh trừ refund hai lần.

### 14.15. Break-glass

Patient scope, purpose, reason, TTL tối đa 4 giờ, auto-expiry, alert và review trong 1 ngày làm việc. Không cấp quyền financial/admin và không thay signer capacity.

### 14.16. Ký/xác nhận thất bại

Provider/verifier unavailable, credential bị revoke, digest mismatch hoặc biometric không đạt thì version giữ trạng thái chưa ký/xác nhận. Không tự hạ cấp sang `INTERNAL_PROVENANCE` hoặc publish. Retry/fallback chỉ dùng phương thức đã phê duyệt, giữ correlation và audit.

### 14.17. Mismatch định danh

Số định danh hoặc ElectronicIdentityLink không khớp, hết hiệu lực, bị revoke hoặc nghi dùng lại thì không tự merge/relink Patient. Tạo review case, khóa hành vi nhạy cảm theo policy và giữ lịch sử nguồn/evidence.

### 14.18. Hồ sơ giấy chuyển tiếp và chuyển đổi

Đợt đang điều trị dùng giấy tiếp tục theo Điều 5.1 TT13 hoặc cutover có quyết định. Conversion batch thiếu trang, sai Patient, checksum mismatch, file mờ/malware hoặc không đối soát phải quarantine; không công bố là hồ sơ điện tử hoàn chỉnh và không tự hủy bản giấy.

### 14.19. Restore hoặc truy xuất không đạt

Backup restore kỹ thuật nhưng version chain, attestation digest, attachment checksum hoặc sample retrieval sai thì drill FAILED. Yêu cầu truy xuất cho điều trị/kiểm tra/thanh tra/nghiên cứu/quản lý thiếu purpose, scope hoặc approval bị từ chối và audit; không dùng break-glass để vượt quy trình không khẩn cấp.

---

## 17. Quy tắc nghiệp vụ cốt lõi

1. SlotHold 5 phút; only valid payment outcome tạo Appointment.
2. Cọc bằng min(100.000 VND, estimated-price snapshot).
3. Capacity tính hold active + mọi Appointment còn giữ reservation; check-in không giải phóng chỗ.
4. Mỗi PractitionerRole DOCTOR tối đa 4 ca/ngày, 2 mỗi buổi.
5. CheckIn staff-assisted trong Release 1; ngoại lệ có permission/reason.
6. Appointment, CheckIn, Visit, Encounter, QueueEntry có lifecycle riêng.
7. NO_SHOW chỉ từ CONFIRMED chưa CheckIn/Visit.
8. QueueAdjustment không sửa checked_in_at; policy 1 tồn : 3 hiện tại là default versioned.
9. Encounter tối đa một Episode PRIMARY; Episode có CareTeam riêng.
10. Referral cần nơi nhận quyết định; same-day không tạo Appointment.
11. Result immutable version; FINAL/amend/correct phải có attestation mới theo Order type trước publish.
12. ServiceDelivery là nguồn ChargeItem; một delivery tối đa một original charge.
13. Ledger capture/refund bất biến; proposer khác approver.
14. Dependent deny-by-default theo tier/scope.
15. Treatment access và break-glass có hiệu lực thời gian/audit.
16. Tiền numeric chính xác; instant UTC; display Asia/Ho_Chi_Minh.
17. Idempotency, optimistic lock, inbox/outbox áp dụng theo ADR.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[04-vong-doi-va-nghiep-vu-lich-kham|Scheduling/queue]]
- [[05-thanh-toan-va-doanh-thu|Payment]]
- [[07-phan-quyen|RBAC]]
- [[14-gia-dinh-cau-hoi-va-dinh-huong#22.1. Quyết định đã chốt|Decisions]]
<!-- related-links:end -->
