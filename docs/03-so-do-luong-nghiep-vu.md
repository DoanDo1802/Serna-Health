---
aliases:
  - Sơ đồ luồng nghiệp vụ
tags:
  - do-an/so-do
source_sections:
  - 4
  - 5
  - 6
---
# Sơ đồ luồng nghiệp vụ

<!-- obsidian-nav:start -->
[[02-tac-nhan-va-chuc-nang|Phần trước]] · [[docs|Mục lục]] · [[04-vong-doi-va-nghiep-vu-lich-kham|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 4. Sơ đồ luồng tổng thể

```mermaid
flowchart TD
    A[Bệnh nhân chọn Department/Practitioner/Service/ca] --> B[Tạo SlotHold 5 phút]
    B --> C[Tạo PaymentIntent qua payment port]
    C --> D{Success hợp lệ trước expiry?}
    D -->|Không, failed/expired| E[Giải phóng reservation]
    D -->|Late success| X[Reconciliation/refund, không tạo lịch]
    D -->|Có| F[Commit Payment + Appointment CONFIRMED]
    F --> G[Nhắc lịch nếu còn đủ 24 giờ]
    G --> H[Staff CheckIn trong cửa sổ 60/30]
    H --> I[Tạo/lấy Visit + Encounter + QueueEntry]
    I --> J[Queue WAITING/CALLED/IN_SERVICE]
    J --> K[Doctor ghi ClinicalNote/Diagnosis]
    K --> L[Xác nhận ServiceDelivery]
    L --> M[Tạo đúng một ChargeItem]
    M --> N{Cần tiếp tục?}
    N -->|Same-day Referral| O[Encounter đích trong Visit]
    N -->|Future Referral| P[ReferralSlotRequest rồi Appointment]
    N -->|Order| Q[Diagnostics tranche]
    N -->|Không| R[Complete Encounter/Queue/Visit]
    R --> S[Settle/close BillingAccount khi đủ guard]
```

## 5. Sơ đồ phối hợp giữa các tác nhân

```mermaid
sequenceDiagram
    autonumber
    actor BN as Bệnh nhân/Đại diện
    participant HT as MediCore
    actor NV as Receptionist/QueueCoordinator
    actor BS as Doctor/CareTeam
    participant KTV as Technician
    actor KY as Authorized Finalizer
    actor TN as Cashier

    BN->>HT: Chọn ca
    HT->>HT: Tạo SlotHold + PaymentIntent
    BN->>HT: Hoàn tất mock/QR payment
    HT->>HT: Inbox + transaction tạo Appointment đúng một lần
    BN->>NV: Xuất trình mã lịch/giấy tờ
    NV->>HT: Staff CheckIn idempotent
    HT->>HT: Visit + Encounter + QueueEntry
    NV->>HT: Gọi số
    BS->>HT: Bắt đầu Encounter, ghi Note/Diagnosis
    BS->>HT: Xác nhận ServiceDelivery
    HT->>HT: Tạo ChargeItem idempotent
    TN->>HT: Thu/phân bổ payment nếu còn số dư
    opt Order ở diagnostics tranche
        BS->>HT: Tạo Order
        KTV->>HT: Nhập Result PRELIMINARY
        KY->>HT: Ký Result FINAL theo Order type
        HT-->>BN: Công bố latest signed Result
    end
    BS->>HT: Complete Encounter
    NV->>HT: Complete Visit khi hard guards đạt
```

`Authorized Finalizer` là PractitionerRole có permission chuyên môn; Admin không mặc định ký Result.

## 6. Luồng đăng ký trực tiếp tại quầy

```mermaid
flowchart TD
    A[Bệnh nhân đến quầy] --> B[Tìm/tạo Patient hoặc dependent]
    B --> C{Khám ngay hay tương lai?}
    C -->|Tương lai| D[SlotHold + PaymentIntent]
    D --> E[Appointment CONFIRMED]
    C -->|Khám ngay| F{Đủ năng lực tiếp nhận?}
    F -->|Không| G[Đề xuất ca khác]
    F -->|Có| H[Tạo Visit walk-in]
    H --> I[Encounter + QueueEntry + BillingAccount]
    I --> J[Khám + ServiceDelivery]
    J --> K[ChargeItem + cash/mock QR]
```

Walk-in không cần Appointment giả. CheckIn ngoại lệ ngoài cửa sổ cần staff permission và reason.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[04-vong-doi-va-nghiep-vu-lich-kham|Vòng đời và ca khám]]
- [[05-thanh-toan-va-doanh-thu|Payment]]
- [[11-mo-hinh-du-lieu|Mô hình dữ liệu]]
- [[20-so-quyet-dinh-kien-truc|Kiến trúc]]
<!-- related-links:end -->
