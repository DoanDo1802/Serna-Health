---
aliases:
  - Thanh toán và doanh thu
tags:
  - do-an/nghiep-vu
source_sections:
  - 9
---
# Thanh toán và doanh thu

<!-- obsidian-nav:start -->
[[04-vong-doi-va-nghiep-vu-lich-kham|Phần trước]] · [[docs|Mục lục]] · [[06-ho-so-suc-khoe-va-kham|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 9. Thanh toán và doanh thu

### 9.1. Resource tài chính

- SlotHold giữ giá/cọc snapshot.
- PaymentIntent liên kết SlotHold và adapter trước khi Appointment tồn tại.
- Payment là capture/money movement đã xác nhận; không bị ghi đè khi refund.
- Mỗi Visit có đúng một BillingAccount.
- ServiceDelivery xác nhận dịch vụ thực hiện và là nguồn canonical của ChargeItem.
- PaymentAllocation phân bổ capture vào BillingAccount.
- Refund là money movement ra riêng, giữ Payment gốc.

### 9.2. Chính sách đặt cọc, đổi và hủy

```text
Mức cọc = min(100.000 VNĐ, giá dự kiến snapshot)
Thời hạn SlotHold = 5 phút
Mốc 24 giờ tính theo Asia/Ho_Chi_Minh
```

- Cọc hợp lệ mới tạo Appointment `CONFIRMED`.
- Đổi trước ít nhất 24 giờ: giữ ca mới hợp lệ, tạo Appointment mới, chuyển cọc và đánh lịch cũ `RESCHEDULED` trong workflow có compensation.
- Hủy trước ít nhất 24 giờ: hoàn 100%.
- Hủy trong 24 giờ hoặc `NO_SHOW`: không hoàn.
- Bệnh viện hủy: hoàn 100% hoặc chuyển cọc nếu bệnh nhân chọn lịch thay thế.
- Dịch vụ giá 0 không gọi provider; command idempotent vẫn tạo Appointment theo policy zero-payment.

### 9.3. Payment port và phương thức

- Release 1 dùng mock adapter provider-neutral; provider thật còn tại `OPEN-PAY-01` và không chặn Release 1.
- Cọc online: PaymentIntent qua payment port.
- Tại quầy: cash và QR.
- Provider event vào WebhookInbox, kiểm tra signature/replay/payload hash trước xử lý.
- Adapter chuẩn hóa event type/ID, provider transaction, amount/currency, `provider_occurred_at`, received time, signature status và trust outcome. Provider time chỉ trusted khi nằm trong signed payload hợp lệ, parse có offset và trong clock-skew ±5 phút quanh received time.
- Missing/invalid/untrusted provider time không tạo Appointment; PaymentIntent vào `RECONCILIATION_REQUIRED`.
- Unique provider transaction theo `(provider, provider_transaction_id)`.

### 9.4. Late webhook và transaction boundary

Khi success đến:

1. Khóa PaymentIntent, SlotHold và AppointmentSlot.
2. Xác minh amount/currency, provider event và `expires_at`.
3. Chỉ khi provider success có `provider_occurred_at < expires_at` và reservation còn hợp lệ: ghi Payment, chuyển hold `CONSUMED`, tạo đúng một Appointment trong transaction.
4. Tại/sau expiry hoặc hold không còn dùng được: không tạo Appointment, không oversell; Payment capture giữ `CAPTURED`, PaymentIntent ghi `RECONCILIATION_REQUIRED` và tạo refund/reconciliation workflow.
5. Retry cùng event trả cùng kết quả, không tạo Payment/Appointment thứ hai.

Bằng expiry là late (`provider_occurred_at >= expires_at`). `received_at` chỉ phục vụ vận hành/audit, không thay business time. Typed evidence và trust rule tại [[schema/scheduling-payment-r1|schema scheduling/payment]].

### 9.4.1. Chuyển cọc khi reschedule

Payment capture bất biến. `DepositAllocation` gắn amount cọc với Appointment; `DepositTransfer` giữ source/target lineage. Cọc bằng nhau transfer toàn bộ. Cọc mới cao hơn phải capture phần chênh trước transaction reschedule; thất bại giữ lịch/cọc cũ. Cọc mới thấp hơn transfer đúng required amount và đưa phần dư vào `REFUND_PENDING`/reconciliation. External refund chạy qua outbox sau commit; không sửa hoặc xóa capture gốc.

### 9.5. Ledger và số dư canonical

```text
charge_total = tổng ChargeItem.net_amount hợp lệ, loại bản REVERSED
paid_total   = tổng PaymentAllocation từ capture hợp lệ
               - tổng RefundAllocation COMPLETED của account
balance_due  = charge_total - paid_total
```

Không tính doanh thu từ current workflow status của Payment; capture và refund là ledger movement bất biến. Nhờ vậy Payment đã refund không bị trừ hai lần.

### 9.6. Refund, reversal và đối soát

- RefundRequest nhắm Payment gốc; ChargeItemReversalRequest nhắm ChargeItem gốc.
- Cashier đề xuất; FinanceApprover khác proposer duyệt.
- Chỉ request `APPROVED` được execute.
- Tổng Refund COMPLETED không vượt refundable amount.
- ChargeItem `BILLED` sửa bằng reversal và replacement, không xóa.
- Refund dự kiến 3–7 ngày làm việc sau duyệt.
- Đối soát xử lý missing/duplicate/out-of-order webhook và provider outage.

Chi tiết: [[adr/0006-payment-slothold-va-billing-ledger|ADR-0006]], [[18-billing-account-va-charge-item|Billing]], [[21-schema-vat-ly-mvp#Billing và payment|Schema]].

---

<!-- related-links:start -->
## Liên kết liên quan

- [[04-vong-doi-va-nghiep-vu-lich-kham#8.3. Đặt lịch, giữ chỗ và đặt cọc|SlotHold/cọc]]
- [[07-phan-quyen|Quyền tài chính]]
- [[11-mo-hinh-du-lieu#16.5. Billing và thanh toán|ERD tài chính]]
- [[18-billing-account-va-charge-item|Billing chi tiết]]
<!-- related-links:end -->
