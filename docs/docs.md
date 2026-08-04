# TÀI LIỆU DỰ ÁN QUẢN LÝ QUY TRÌNH KHÁM BỆNH

> Phiên bản tài liệu: 3.1 — TT13 regulatory design baseline
> Ngày cập nhật: 31/07/2026
> Trạng thái: GO kỹ thuật cho Phase 1 Release 1; legal/production gate còn BLOCKED theo ma trận TT13

---

## Giới thiệu

MediCore số hóa lập kế hoạch, tiếp nhận, khám đa chuyên khoa và chăm sóc liên tục. Tài liệu phân biệt rõ SlotHold, Appointment, CheckIn, Visit, Encounter và EpisodeOfCare; dùng khái niệm gần HIS/HL7 FHIR nhưng chưa tuyên bố compliance.

> [!WARNING]
> Tài liệu này là design baseline hướng tới đáp ứng TT13/2025/TT-BYT. Nó không chứng nhận sản phẩm hoặc cơ sở khám bệnh, chữa bệnh đã tuân thủ. Production/legal readiness phụ thuộc [[23-ma-tran-yeu-cau-tt13-2025|ma trận TT13]], Chương X TT32, quy chế đã ban hành, triển khai, kiểm thử và evidence vận hành.

> [!IMPORTANT]
> Appointment là kế hoạch; Visit là lần tiếp nhận thực tế. CheckIn liên kết hai resource nhưng không làm chúng thành một. Release 1 là thin operational slice, không phải toàn bộ MVP.

## Thuật ngữ chuẩn

| Thuật ngữ | Tên tiếng Việt | Ý nghĩa |
|---|---|---|
| `UserAccount` | Tài khoản | Principal đăng nhập; khác Patient identity |
| `Practitioner` | Nhân sự chuyên môn | Bác sĩ/KTV/người ký được biểu diễn bằng PractitionerRole |
| `Patient` | Bệnh nhân | Người được quản lý xuyên suốt; không dùng số định danh làm PK |
| `PatientIdentifier` | Định danh bệnh nhân | Identifier có issuer/status/verification, bảo vệ dữ liệu |
| `ElectronicIdentityLink` | Liên kết định danh điện tử | Liên kết tài khoản/subject bên ngoài với Patient/account theo evidence |
| `AppointmentSlot` | Ca khám | Ca theo PractitionerRole/Department/Service, có giờ/capacity |
| `SlotHold` | Giữ chỗ | Reservation tối đa 5 phút trước Appointment |
| `PaymentIntent` | Ý định thanh toán | Checkout liên kết SlotHold trước Appointment |
| `Appointment` | Lịch hẹn | Kế hoạch đã xác nhận; có lineage khi reschedule |
| `CheckIn` | Tiếp nhận theo lịch | Resource audit/idempotency tạo hoặc lấy Visit |
| `Visit` | Lần đến viện | Đợt tiếp nhận thực tế, có thể walk-in |
| `Encounter` | Phiên chuyên môn | Tương tác chuyên môn trong Visit |
| `QueueEntry` | Mục hàng chờ | Vòng đời gọi/phục vụ của Encounter |
| `EpisodeOfCare` | Đợt chăm sóc | Quá trình theo một vấn đề sức khỏe qua nhiều Visit |
| `CareTeam` | Nhóm chăm sóc | Thành viên/role theo thời gian của Episode |
| `Referral` | Chuyển chăm sóc | Yêu cầu nơi nhận quyết định, không phải Appointment |
| `ClinicalOrder` | Chỉ định | Yêu cầu laboratory/imaging |
| `ClinicalResult` | Kết quả | Identity có immutable result versions |
| `ClinicalAttachment` | Tệp lâm sàng | Metadata/checksum/storage reference gắn owner resource/version |
| `ElectronicAttestation` | Bằng chứng ký/xác nhận | Evidence bất biến nhắm target version/digest theo signer/method policy |
| `ServiceDelivery` | Dịch vụ thực hiện | Bằng chứng dịch vụ đã thực hiện, nguồn ChargeItem |
| `BillingAccount` | Tài khoản viện phí | Ledger aggregate theo Visit |
| `ChargeItem` | Khoản tính phí | Price snapshot từ ServiceDelivery |
| `Payment` | Capture thanh toán | Money movement thu bất biến |
| `Refund` | Hoàn tiền | Money movement ra, giữ Payment gốc |

## Quan hệ nghiệp vụ chuẩn

```text
UserAccount ─ PatientAccountLink ─ Patient
Patient → SlotHold → PaymentIntent → Appointment
Appointment → CheckIn → Visit → Encounter → QueueEntry
Encounter → ClinicalNote/Diagnosis/ServiceDelivery
Encounter ↔ EpisodeOfCare → CareTeam
ServiceDelivery → ChargeItem → BillingAccount ← PaymentAllocation
```

- Walk-in tạo Visit trực tiếp, không tạo Appointment giả.
- Encounter suy ra Patient qua Visit; Episode liên kết phải cùng Patient.
- CheckIn/command/webhook idempotent; signed clinical/financial movement không ghi đè.
- Domain state `SIGNED` không tự chứng minh chữ ký điện tử hợp pháp; content cần ký/xác nhận phải có `ElectronicAttestation` hợp lệ theo ADR-0008.
- Kiểu và constraint vật lý tại [[21-schema-vat-ly-mvp|Schema vật lý MVP]].

## Phân kỳ phạm vi

### Release 1

Catalog/identity → Patient → slot/hold → mock payment → Appointment → staff CheckIn → Visit/Encounter/Queue → ClinicalNote/Diagnosis tối thiểu → ServiceDelivery/ChargeItem → cash/mock allocation → completion/audit.

### Full MVP sau Release 1

Dependent tier, Episode/CareTeam/Referral, Order/Result non-critical, real QR, refund/reversal, dashboard/notification hardening.

### Sau MVP

Inpatient/bed, merge/split Episode, Specimen/LIS/PACS, critical diagnostics đầy đủ, insurance, invoice, FHIR integration ngoài.

## Mục lục theo chủ đề

| Tài liệu | Phần |
|---|---:|
| [[01-tong-quan-va-pham-vi|Tổng quan và phạm vi]] | 1–2 |
| [[02-tac-nhan-va-chuc-nang|Tác nhân và chức năng]] | 3, 12 |
| [[03-so-do-luong-nghiep-vu|Sơ đồ luồng nghiệp vụ]] | 4–6 |
| [[04-vong-doi-va-nghiep-vu-lich-kham|Appointment, Visit và Encounter]] | 7–8 |
| [[05-thanh-toan-va-doanh-thu|Thanh toán và doanh thu]] | 9 |
| [[06-ho-so-suc-khoe-va-kham|Hồ sơ sức khỏe và khám]] | 10 |
| [[07-phan-quyen|Phân quyền]] | 11 |
| [[08-dashboard-quan-ly|Dashboard quản lý]] | 13 |
| [[09-ngoai-le-va-quy-tac-nghiep-vu|Ngoại lệ và quy tắc nghiệp vụ]] | 14, 17 |
| [[10-thong-bao|Thông báo]] | 15 |
| [[11-mo-hinh-du-lieu|Mô hình dữ liệu]] | 16 |
| [[12-yeu-cau-phi-chuc-nang|Yêu cầu phi chức năng]] | 18 |
| [[13-ke-hoach-va-nghiem-thu-mvp|Kế hoạch và nghiệm thu MVP]] | 19–20 |
| [[14-gia-dinh-cau-hoi-va-dinh-huong|Giả định, quyết định và định hướng]] | 21–24 |
| [[15-episode-careteam-va-referral|EpisodeOfCare, CareTeam và Referral]] | 25 |
| [[16-orders-va-results|Orders và Results]] | 26 |
| [[17-noi-tru-va-giuong-benh|Nội trú và giường bệnh]] | 27 |
| [[18-billing-account-va-charge-item|BillingAccount và ChargeItem]] | 28 |

## Tài liệu triển khai Phase 0

| Artifact | Vai trò |
|---|---|
| [[19-ket-qua-phase-0|Kết quả Phase 0]] | Baseline, validation, readiness và GO/NO-GO |
| [[20-so-quyet-dinh-kien-truc|Sổ quyết định kiến trúc]] | Stack, module map, deployment baseline |
| [[21-schema-vat-ly-mvp|Schema vật lý MVP]] | Contract PostgreSQL/JPA trước migration |
| [[22-backlog-mvp|Backlog MVP]] | Release, dependency, scenarios, DoR/DoD |
| [[23-ma-tran-yeu-cau-tt13-2025|Ma trận TT13]] | Requirement, gap, owner và production blockers |
| [[24-khung-quy-che-van-hanh-hsba-dien-tu|Khung quy chế HSBA điện tử]] | DRAFT quy chế vận hành, ký/xác nhận, chuyển đổi giấy |
| [[25-api-inventory-r1|API inventory Release 1]] | Endpoint, security, headers và operation trace |
| [[adr/README|ADR index]] | Context, lựa chọn và hệ quả kiến trúc |

## Luồng đọc đề xuất

1. [[01-tong-quan-va-pham-vi|Tổng quan/phạm vi]].
2. [[03-so-do-luong-nghiep-vu|Luồng end-to-end]].
3. [[04-vong-doi-va-nghiep-vu-lich-kham|Scheduling/CheckIn/Queue]].
4. [[06-ho-so-suc-khoe-va-kham|Hồ sơ/dependent]].
5. [[05-thanh-toan-va-doanh-thu|Payment]] và [[18-billing-account-va-charge-item|Billing]].
6. [[15-episode-careteam-va-referral|Episode/Referral]] và [[16-orders-va-results|Diagnostics]].
7. [[07-phan-quyen|RBAC]] và [[12-yeu-cau-phi-chuc-nang|NFR]].
8. [[14-gia-dinh-cau-hoi-va-dinh-huong|Decision register]].
9. [[20-so-quyet-dinh-kien-truc|Architecture]] → [[11-mo-hinh-du-lieu|ERD logic]] → [[21-schema-vat-ly-mvp|physical schema]].
10. [[22-backlog-mvp|Backlog]] và [[19-ket-qua-phase-0|Phase 0 gate]].
11. [[23-ma-tran-yeu-cau-tt13-2025|Ma trận TT13]] và [[24-khung-quy-che-van-hanh-hsba-dien-tu|khung quy chế]] trước mọi tuyên bố production/legal readiness.

## Mục lục đầy đủ 28 phần nghiệp vụ

1. [[01-tong-quan-va-pham-vi#1. Tổng quan dự án|Tổng quan dự án]]
2. [[01-tong-quan-va-pham-vi#2. Phạm vi đã thống nhất|Phạm vi đã thống nhất]]
3. [[02-tac-nhan-va-chuc-nang#3. Tác nhân và principal canonical|Tác nhân canonical]]
4. [[03-so-do-luong-nghiep-vu#4. Sơ đồ luồng tổng thể|Sơ đồ luồng tổng thể]]
5. [[03-so-do-luong-nghiep-vu#5. Sơ đồ phối hợp giữa các tác nhân|Sơ đồ phối hợp]]
6. [[03-so-do-luong-nghiep-vu#6. Luồng đăng ký trực tiếp tại quầy|Đăng ký tại quầy]]
7. [[04-vong-doi-va-nghiep-vu-lich-kham#7. Vòng đời SlotHold, Appointment, Visit và Encounter|Vòng đời]]
8. [[04-vong-doi-va-nghiep-vu-lich-kham#8. Luồng nghiệp vụ chi tiết|Luồng chi tiết]]
9. [[05-thanh-toan-va-doanh-thu#9. Thanh toán và doanh thu|Thanh toán]]
10. [[06-ho-so-suc-khoe-va-kham#10. Hồ sơ sức khỏe và hồ sơ khám|Hồ sơ]]
11. [[07-phan-quyen#11. Phân quyền theo action và context|Phân quyền]]
12. [[02-tac-nhan-va-chuc-nang#12. Chức năng theo tác nhân|Chức năng tác nhân]]
13. [[08-dashboard-quan-ly#13. Dashboard quản lý|Dashboard]]
14. [[09-ngoai-le-va-quy-tac-nghiep-vu#14. Xử lý các trường hợp phát sinh|Ngoại lệ]]
15. [[10-thong-bao#15. Thông báo|Thông báo]]
16. [[11-mo-hinh-du-lieu#16. Mô hình dữ liệu khái niệm|Mô hình dữ liệu]]
17. [[09-ngoai-le-va-quy-tac-nghiep-vu#17. Quy tắc nghiệp vụ cốt lõi|Quy tắc cốt lõi]]
18. [[12-yeu-cau-phi-chuc-nang#18. Yêu cầu phi chức năng|NFR]]
19. [[13-ke-hoach-va-nghiem-thu-mvp#19. Phạm vi MVP đề xuất|Phạm vi MVP]]
20. [[13-ke-hoach-va-nghiem-thu-mvp#20. Tiêu chí nghiệm thu MVP|Nghiệm thu]]
21. [[14-gia-dinh-cau-hoi-va-dinh-huong#21. Các giả định đang dùng|Giả định]]
22. [[14-gia-dinh-cau-hoi-va-dinh-huong#22. Quyết định đã chốt và câu hỏi còn mở|Quyết định]]
23. [[14-gia-dinh-cau-hoi-va-dinh-huong#23. Hướng phát triển sau MVP|Hướng phát triển]]
24. [[14-gia-dinh-cau-hoi-va-dinh-huong#24. Tóm tắt sản phẩm|Tóm tắt]]
25. [[15-episode-careteam-va-referral#25. Điều phối chăm sóc theo EpisodeOfCare|Episode/Referral]]
26. [[16-orders-va-results#26. Chỉ định và kết quả|Orders/Results]]
27. [[17-noi-tru-va-giuong-benh#27. Admission, Discharge và BedAssignment|Nội trú]]
28. [[18-billing-account-va-charge-item#28. BillingAccount, ChargeItem và Payment|Billing]]

## Toolchain local

```bash
export JAVA_HOME=/usr/local/opt/openjdk@21
export PATH="/usr/local/opt/openjdk@21/bin:/usr/local/opt/node@24/bin:$PATH"
```
