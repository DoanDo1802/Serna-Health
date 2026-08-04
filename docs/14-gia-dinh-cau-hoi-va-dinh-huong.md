---
aliases:
  - Giả định, quyết định và định hướng
tags:
  - do-an/dinh-huong
source_sections:
  - 21
  - 22
  - 23
  - 24
---
# Giả định, quyết định và định hướng

<!-- obsidian-nav:start -->
[[13-ke-hoach-va-nghiem-thu-mvp|Phần trước]] · [[docs|Mục lục]] · [[15-episode-careteam-va-referral|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 21. Các giả định đang dùng

1. Một bệnh viện, nhiều khoa/phòng; web responsive triển khai trên cloud.
2. Appointment là kế hoạch; Visit sinh từ CheckIn hoặc walk-in.
3. Bệnh nhân chọn ca khám có sức chứa, không chọn phút bắt đầu Encounter chính xác.
4. Một Visit có nhiều Encounter/chuyên khoa; Encounter liên kết Episode qua EncounterEpisode.
5. Mỗi Episode có CareTeam riêng và một bác sĩ phụ trách.
6. Nội trú đầy đủ, Specimen/barcode, LIS/PACS, bảo hiểm và tích hợp ngoài nằm sau MVP.
7. Mục tiêu tải ban đầu khoảng 1.000 Visit/ngày; workload peak được chốt tại `NFR-11`.
8. Release 1 là thin operational slice, không đồng nghĩa toàn bộ phạm vi MVP.

---

## 22. Quyết định đã chốt và câu hỏi còn mở

### Quy ước trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| `ACCEPTED` | Contract đã khóa, được dùng cho thiết kế/triển khai |
| `OPEN` | Chưa quyết định; row phải có owner, target và gate |
| `DEFERRED` | Đã đưa sang release/sau MVP; không chặn release hiện tại |
| `SUPERSEDED` | Bị quyết định mới thay; giữ để truy nguyên |

File này là decision register canonical. ADR lưu bối cảnh/lý do; schema vật lý nằm tại [[21-schema-vat-ly-mvp|Schema vật lý MVP]].

### 22.1. Quyết định đã chốt

#### Appointment, ca khám và hàng chờ

| Mã | Quyết định | Trạng thái | Phạm vi | ADR/Chi tiết |
|---|---|---|---|---|
| `APT-01` | SlotHold giữ chỗ 5 phút | ACCEPTED | MVP | [[04-vong-doi-va-nghiep-vu-lich-kham#7.1. Trạng thái SlotHold|SlotHold]] |
| `APT-02` | Cọc bằng `min(100.000 VNĐ, giá dự kiến)` | ACCEPTED | MVP | [[05-thanh-toan-va-doanh-thu#9.2. Chính sách đặt cọc, đổi và hủy|Cọc]] |
| `APT-03` | Chỉ tạo Appointment CONFIRMED sau cọc thành công hợp lệ | ACCEPTED | MVP | [[adr/0006-payment-slothold-va-billing-ledger|ADR-0006]] |
| `APT-04` | Đổi trước 24 giờ chuyển cọc; hủy trước 24 giờ hoàn đủ | ACCEPTED | MVP | [[05-thanh-toan-va-doanh-thu#9.2. Chính sách đặt cọc, đổi và hủy|Đổi/hủy]] |
| `APT-05` | Sau hạn/NO_SHOW không hoàn; bệnh viện hủy hoàn đủ | ACCEPTED | MVP | [[05-thanh-toan-va-doanh-thu#9.2. Chính sách đặt cọc, đổi và hủy|Hoàn cọc]] |
| `APT-06` | Reschedule tạo Appointment mới, lịch cũ RESCHEDULED và giữ lineage | ACCEPTED | Release 1 | [[adr/0005-appointment-checkin-queue-va-reschedule|ADR-0005]] |
| `SHIFT-01` | Mỗi bác sĩ tối đa 4 ca/ngày, 2 ca mỗi buổi | ACCEPTED | MVP | [[04-vong-doi-va-nghiep-vu-lich-kham#7.4. Ca khám và sức chứa|Ca khám]] |
| `SHIFT-02` | Admin cấu hình giờ/capacity theo bác sĩ và ca | ACCEPTED | MVP | [[04-vong-doi-va-nghiep-vu-lich-kham#7.4. Ca khám và sức chứa|Cấu hình]] |
| `CHECKIN-01` | CheckIn là resource canonical; Release 1 staff-assisted | ACCEPTED | Release 1 | [[adr/0005-appointment-checkin-queue-va-reschedule|ADR-0005]] |
| `QUEUE-01` | Cửa sổ check-in mở trước ca 60 phút, đóng trước kết thúc 30 phút | ACCEPTED | MVP | [[04-vong-doi-va-nghiep-vu-lich-kham#7.5. CheckIn và QueueEntry|Cửa sổ]] |
| `QUEUE-02` | Sau hạn chỉ staff có quyền check-in ngoại lệ với lý do | ACCEPTED | MVP | [[09-ngoai-le-va-quy-tac-nghiep-vu#14.2. Bệnh nhân đến sau hạn check-in|Ngoại lệ]] |
| `QUEUE-03` | Chỉ Appointment CONFIRMED chưa CheckIn/Visit mới thành NO_SHOW | ACCEPTED | MVP | [[adr/0005-appointment-checkin-queue-va-reschedule|ADR-0005]] |
| `QUEUE-04` | Trong ca xếp theo checked_in_at; hàng tồn xen theo QueuePolicy | ACCEPTED | MVP | [[04-vong-doi-va-nghiep-vu-lich-kham#7.5. CheckIn và QueueEntry|Queue]] |
| `QUEUE-05` | Điều chỉnh queue bắt buộc before/after, actor, reason và audit | ACCEPTED | MVP | [[09-ngoai-le-va-quy-tac-nghiep-vu#14.9. Hàng chờ tồn sang ca sau|Adjustment]] |
| `QUEUE-06` | Queue states: WAITING, CALLED, IN_SERVICE, DEFERRED, COMPLETED, CANCELLED, ENTERED_IN_ERROR | ACCEPTED | Release 1 | [[adr/0005-appointment-checkin-queue-va-reschedule|ADR-0005]] |
| `QUEUE-07` | Mặc định xen 1 hàng tồn sau mỗi 3 bệnh nhân ca hiện tại; khoa được override versioned/audited | ACCEPTED | Release 1 | [[adr/0005-appointment-checkin-queue-va-reschedule|ADR-0005]] |
| `VISIT-01` | Visit complete khi Encounter/QueueEntry terminal và không còn same-day Referral pending | ACCEPTED | Release 1 | [[adr/0005-appointment-checkin-queue-va-reschedule|ADR-0005]] |
| `VISIT-02` | Order/Result/Episode/billing mở chỉ warning/follow-up, không chặn clinical completion | ACCEPTED | Release 1 | [[adr/0005-appointment-checkin-queue-va-reschedule|ADR-0005]] |

#### EpisodeOfCare, Referral và diagnostics

| Mã | Quyết định | Trạng thái | Phạm vi | ADR/Chi tiết |
|---|---|---|---|---|
| `EPI-01` | Bác sĩ điều trị tạo/xác nhận Episode | ACCEPTED | MVP | [[15-episode-careteam-va-referral#25.4. Gợi ý Episode và quyết định chuyên môn|Episode]] |
| `EPI-02` | Mỗi Episode có CareTeam riêng và một bác sĩ phụ trách | ACCEPTED | MVP | [[15-episode-careteam-va-referral#25.3. CareTeam và bác sĩ phụ trách|CareTeam]] |
| `EPI-03` | Bác sĩ phụ trách quyết định đóng/mở Episode | ACCEPTED | MVP | [[15-episode-careteam-va-referral#25.5. Trạng thái và điều kiện đóng EpisodeOfCare|Đóng/mở]] |
| `EPI-04` | Encounter tối đa một PRIMARY, nhiều RELATED | ACCEPTED | MVP | [[15-episode-careteam-va-referral#25.2. Quan hệ Patient — EpisodeOfCare — Visit — Encounter|Link]] |
| `EPI-05` | Việc còn mở cảnh báo; override phải có lý do | ACCEPTED | MVP | [[15-episode-careteam-va-referral#25.5. Trạng thái và điều kiện đóng EpisodeOfCare|Override]] |
| `EPI-06` | Bác sĩ phụ trách và điều phối được cấp quyền quản lý CareTeam | ACCEPTED | MVP | [[07-phan-quyen|Quyền]] |
| `EPI-07` | Merge/split cần approval, lineage và audit | DEFERRED | Sau MVP | Gate sau MVP; không có migration MVP |
| `REF-01` | Nơi nhận bắt buộc accept/reject Referral | ACCEPTED | MVP | [[15-episode-careteam-va-referral#25.7. Referral nội bộ và liên chuyên khoa|Referral]] |
| `REF-02` | Same-day Referral tạo Encounter trong Visit hiện tại | ACCEPTED | MVP | [[15-episode-careteam-va-referral#25.7. Referral nội bộ và liên chuyên khoa|Same-day]] |
| `REF-03` | Future Referral tạo yêu cầu chọn ca rồi mới tạo Appointment | ACCEPTED | MVP | [[15-episode-careteam-va-referral#25.7. Referral nội bộ và liên chuyên khoa|Future]] |
| `REF-04` | Reject Referral bắt buộc lý do | ACCEPTED | MVP | [[15-episode-careteam-va-referral#25.7. Referral nội bộ và liên chuyên khoa|Reject]] |
| `ORD-01` | MVP hỗ trợ Order laboratory và diagnostic imaging | ACCEPTED | MVP | [[16-orders-va-results#26.2. Phạm vi loại Order|Order type]] |
| `ORD-02` | KTV nhập PRELIMINARY; authorized finalizer ký FINAL | ACCEPTED | MVP | [[adr/0007-clinical-record-va-result-versioning|ADR-0007]] |
| `ORD-03` | Bệnh nhân chỉ xem latest signed published Result | ACCEPTED | MVP | [[adr/0007-clinical-record-va-result-versioning|ADR-0007]] |
| `ORD-04` | Specimen/barcode/LIS/PACS nằm sau MVP | DEFERRED | Sau MVP | [[16-orders-va-results#26.7. Critical Result gate và phân kỳ|Phân kỳ]] |
| `ORD-05` | Result dùng immutable version, payload schema-versioned và previous-version link | ACCEPTED | Diagnostics tranche | [[adr/0007-clinical-record-va-result-versioning|ADR-0007]] |
| `ORD-06` | Author/finalizer tách riêng; amendment phải ký lại trước publish | ACCEPTED | Diagnostics tranche | [[adr/0007-clinical-record-va-result-versioning|ADR-0007]] |
| `ORD-07` | LAB do LAB_APPROVER ký; imaging do RADIOLOGIST ký; KTV không mặc định ký | ACCEPTED | Diagnostics tranche | [[adr/0007-clinical-record-va-result-versioning|ADR-0007]] |

#### Tài chính

| Mã | Quyết định | Trạng thái | Phạm vi | ADR/Chi tiết |
|---|---|---|---|---|
| `BILL-01` | Mỗi Visit có đúng một BillingAccount | ACCEPTED | MVP | [[18-billing-account-va-charge-item#28.2. Quan hệ dữ liệu|BillingAccount]] |
| `BILL-02` | Chỉ tạo ChargeItem khi dịch vụ được xác nhận thực hiện | ACCEPTED | MVP | [[18-billing-account-va-charge-item#28.4. Phát sinh phí|ChargeItem]] |
| `BILL-03` | Proposer refund/reversal không được tự approve | ACCEPTED | MVP | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `BILL-04` | Quầy hỗ trợ cash/QR; online qua payment port | ACCEPTED | MVP | [[05-thanh-toan-va-doanh-thu#9.3. Payment port và phương thức|Payment]] |
| `BILL-05` | Refund dự kiến 3–7 ngày làm việc sau duyệt | ACCEPTED | MVP | [[05-thanh-toan-va-doanh-thu#9.6. Refund, reversal và đối soát|Refund]] |
| `PAY-02` | PaymentIntent tách Payment và liên kết SlotHold | ACCEPTED | Release 1 | [[adr/0006-payment-slothold-va-billing-ledger|ADR-0006]] |
| `PAY-03` | Mock adapter dùng trong Release 1; provider-neutral port | ACCEPTED | Release 1 | [[adr/0006-payment-slothold-va-billing-ledger|ADR-0006]] |
| `PAY-04` | Inbox + lock slot + PaymentIntent/Payment/SlotHold/Appointment transaction | ACCEPTED | Release 1 | [[adr/0006-payment-slothold-va-billing-ledger|ADR-0006]] |
| `PAY-05` | Late success không còn hold/capacity không tạo Appointment; reconciliation/refund | ACCEPTED | Release 1 | [[adr/0006-payment-slothold-va-billing-ledger|ADR-0006]] |
| `PAY-06` | `provider_occurred_at` chỉ trusted từ signed payload hợp lệ; timestamp thiếu/sai đi reconciliation | ACCEPTED | Release 1 | [[adr/0011-provider-event-time-va-reschedule-deposit|ADR-0011]] |
| `PAY-07` | Cọc gắn Appointment bằng immutable DepositAllocation; reschedule dùng DepositTransfer atomic | ACCEPTED | Release 1 | [[adr/0011-provider-event-time-va-reschedule-deposit|ADR-0011]] |
| `BILL-06` | ServiceDelivery là charge source canonical, tối đa một original ChargeItem | ACCEPTED | Release 1 | [[adr/0006-payment-slothold-va-billing-ledger|ADR-0006]] |
| `BILL-07` | ChargeItem giữ quantity/unit-price/discount/gross/net snapshot | ACCEPTED | Release 1 | [[adr/0006-payment-slothold-va-billing-ledger|ADR-0006]] |
| `BILL-08` | Close account cần Visit completed, delivery settled, no pending và balance 0 | ACCEPTED | Release 1 | [[adr/0006-payment-slothold-va-billing-ledger|ADR-0006]] |
| `BILL-09` | Reopen account cần manager permission, reason, version, audit | ACCEPTED | Release 1 | [[adr/0006-payment-slothold-va-billing-ledger|ADR-0006]] |

#### Hồ sơ, bảo mật và dependent

| Mã | Quyết định | Trạng thái | Phạm vi | ADR/Chi tiết |
|---|---|---|---|---|
| `DEP-01` | Account quản lý dependent qua PatientAccountLink | ACCEPTED | MVP | [[06-ho-so-suc-khoe-va-kham#10.2. Dependent và verification tiers|Dependent]] |
| `DEP-02` | Pending được booking/payment nhưng không xem clinical content | ACCEPTED | MVP | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `DEP-03` | Trẻ em dùng giấy khai sinh; người lớn dùng OTP consent/ủy quyền | ACCEPTED | MVP | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `DEP-04` | Tách dependent sang account riêng sau MVP | DEFERRED | Sau MVP | Giữ Patient ID/lịch sử |
| `DEP-05` | Profile tối thiểu có họ tên/ngày sinh; contact qua account/link, patient phone nullable | ACCEPTED | MVP | [[06-ho-so-suc-khoe-va-kham#10.1. Hồ sơ hành chính bệnh nhân|Profile]] |
| `DEP-06` | Tier 0 PENDING: demographics tối thiểu, booking, payment, queue | ACCEPTED | Dependent tranche | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `DEP-07` | Tier 1 IDENTITY_VERIFIED: Visit/billing hành chính, chưa clinical read | ACCEPTED | Dependent tranche | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `DEP-08` | Tier 2 REPRESENTATION_VERIFIED: clinical read theo permission scope | ACCEPTED | Dependent tranche | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `DEP-09` | Người lớn cần OTP consent hoặc ủy quyền hợp lệ cho Tier 2 | ACCEPTED | Dependent tranche | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `DEP-10` | Trẻ em cần giấy khai sinh + xác minh đại diện cho Tier 2 | ACCEPTED | Dependent tranche | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `DEP-11` | Binary evidence ở private object storage; DB lưu metadata/checksum/audit | ACCEPTED | Dependent tranche | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `SEC-01` | Treatment access kéo dài 30 ngày hậu kiểm từ khi quan hệ cuối kết thúc | ACCEPTED | MVP | [[07-phan-quyen#Break-glass và hậu kiểm|Hậu kiểm]] |
| `SEC-02` | Break-glass bắt buộc reason, patient scope, TTL, alert và review | ACCEPTED | MVP | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `SEC-03` | Permission theo `resource.action`; Role là bundle | ACCEPTED | Release 1 | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `SEC-04` | Authorization kết hợp role, khoa, quan hệ, scope và thời gian | ACCEPTED | Release 1 | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `SEC-05` | Audit append-only có actor/outcome/reason/correlation/before-after | ACCEPTED | Release 1 | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `AUTH-01` | R1 hỗ trợ email/password và one-time code qua email đã xác minh | ACCEPTED | Release 1 | [[adr/0010-authentication-session-va-account-security|ADR-0010]] |
| `AUTH-02` | Password 12–128 ký tự, Argon2id, common/breached-password policy, không rotation định kỳ | ACCEPTED | Release 1 | [[adr/0010-authentication-session-va-account-security|ADR-0010]] |
| `AUTH-03` | OTP hash-at-rest, TTL 10 phút, 5 attempts, resend 60 giây, tối đa 5 lần/giờ | ACCEPTED | Release 1 | [[adr/0010-authentication-session-va-account-security|ADR-0010]] |
| `AUTH-04` | Opaque server session: idle 30 phút, absolute 12 giờ, secure cookie + CSRF | ACCEPTED | Release 1 | [[adr/0010-authentication-session-va-account-security|ADR-0010]] |
| `AUTH-05` | Verification/reset token one-time; reset TTL 30 phút; generic anti-enumeration response | ACCEPTED | Release 1 | [[adr/0010-authentication-session-va-account-security|ADR-0010]] |
| `AUTH-06` | 5 failure khóa 15 phút; reset/email change/disable/lock revoke mọi session/token | ACCEPTED | Release 1 | [[adr/0010-authentication-session-va-account-security|ADR-0010]] |
| `CLIN-01` | ClinicalNote identity + immutable version; FINALIZED không ghi đè | ACCEPTED | Release 1 | [[adr/0012-technical-finalization-va-lawful-signing-boundary|ADR-0012]] |
| `CLIN-02` | Diagnosis versioned, hỗ trợ code và free text | ACCEPTED | Release 1 | [[adr/0007-clinical-record-va-result-versioning|ADR-0007]] |
| `CLIN-04` | R1 dùng FINALIZED cho hoàn tất kỹ thuật; SIGNED chỉ active khi có lawful attestation | ACCEPTED | Release 1 | [[adr/0012-technical-finalization-va-lawful-signing-boundary|ADR-0012]] |

`CLIN-03` giữ OPEN trong bảng regulatory bên dưới vì liên quan completeness pháp lý, không phải contract code Release 1.

#### Regulatory, identity, signing và records management

| Mã | Quyết định | Trạng thái | Owner | Target/Gate | Chặn |
|---|---|---|---|---|---|
| `CLIN-03` | Health baseline, PrescriptionItem, Attachment là design baseline; completeness pháp lý phụ thuộc TT32 mapping | OPEN | Clinical Records + Product | Trước HSBA production claim | Chặn legal completeness |
| `REG-01` | Ranh giới tuyên bố compliance: design ≠ triển khai ≠ facility compliance | OPEN | Legal + Architecture | Trước public/legal claim | Chặn tuyên bố tuân thủ |
| `REG-02` | Phân rã Chương X TT32 và tiêu chuẩn kỹ thuật CNTT áp dụng | OPEN | Legal + Clinical Records + Architecture | Trước production HSBA | Chặn mapping nội dung hồ sơ |
| `REG-03` | Phân loại cơ sở và lộ trình Điều 4 TT13 | OPEN | Facility Director + Legal | Trước go-live | Chặn deadline/applicability |
| `IDN-01` | MVP thu thập CCCD/số định danh/hộ chiếu vào `PatientIdentifier` ở trạng thái `SELF_DECLARED`, `STAFF_RECORDED` hoặc `MANUALLY_VERIFIED`; không dùng làm Patient PK | ACCEPTED | Identity + Security | Release 1 | Không chặn code R1; chưa hoàn thành TT13-1.3 |
| `IDN-02` | Kết nối định danh điện tử qua provider/kênh được cấp phép để tạo `ElectronicIdentityLink` và `ELECTRONICALLY_VERIFIED` | OPEN | Identity + Legal + Security | Trước HSBA production claim | Chặn TT13-1.3 production |
| `SIGN-01` | Phương thức ký/xác nhận, signer/content matrix và evidence | OPEN | Legal + Clinical + Security | Trước lawful signing | Chặn TT13 Điều 3 |
| `OPS-01` | Quy chế lập/cập nhật/quản lý/lưu trữ/sử dụng/ATTT HSBA điện tử | OPEN | Facility Director + Records + Security | Trước production | Chặn TT13-6.3B |
| `TRANS-01` | Hồ sơ giấy đang điều trị và chuyển đổi hồ sơ giấy cũ | OPEN | Records + Legal | Trước paper cutover/conversion | Chặn TT13 Điều 5 |

#### Kiến trúc, dữ liệu, reliability và delivery

| Mã | Quyết định | Trạng thái | Phạm vi | ADR/Chi tiết |
|---|---|---|---|---|
| `ARCH-01` | React + Spring Boot modular monolith + PostgreSQL | ACCEPTED | MVP | [[adr/0001-stack-va-modular-monolith|ADR-0001]] |
| `ARCH-02` | Module qua public API/event; không chia sẻ JPA entity | ACCEPTED | MVP | [[20-so-quyet-dinh-kien-truc|Architecture]] |
| `ARCH-03` | Một backend/DB; chưa bắt buộc broker/cache | ACCEPTED | Release 1 | [[adr/0001-stack-va-modular-monolith|ADR-0001]] |
| `TECH-01` | React 19, Node 24 LTS, Java 21, Spring Boot 3.5.x, PostgreSQL 17.x | ACCEPTED | MVP | [[20-so-quyet-dinh-kien-truc|Stack]] |
| `API-01` | OpenAPI 3.1 source-first, base `/api/v1`, module fragment + canonical bundle | ACCEPTED | Release 1 | [[adr/0013-api-contract-versioning-error-idempotency|ADR-0013]] |
| `API-02` | Opaque cookie session + CSRF; provider webhook dùng signature security riêng | ACCEPTED | Release 1 | [[adr/0013-api-contract-versioning-error-idempotency|ADR-0013]] |
| `API-03` | Request/correlation/idempotency headers có semantics ổn định | ACCEPTED | Release 1 | [[adr/0013-api-contract-versioning-error-idempotency|ADR-0013]] |
| `API-04` | Mutable resource dùng ETag/If-Match; missing/stale trả 428/412 | ACCEPTED | Release 1 | [[adr/0013-api-contract-versioning-error-idempotency|ADR-0013]] |
| `API-05` | Error `application/problem+json` + stable code/fieldErrors/blockers | ACCEPTED | Release 1 | [[adr/0013-api-contract-versioning-error-idempotency|ADR-0013]] |
| `API-06` | Cursor pagination; ISO offset/UUID/decimal-string money | ACCEPTED | Release 1 | [[adr/0013-api-contract-versioning-error-idempotency|ADR-0013]] |
| `DATA-01` | UUIDv7 application-generated, PostgreSQL uuid | ACCEPTED | MVP | [[adr/0002-postgresql-dinh-danh-tien-va-thoi-gian|ADR-0002]] |
| `DATA-02` | timestamptz UTC; display Asia/Ho_Chi_Minh | ACCEPTED | MVP | [[adr/0002-postgresql-dinh-danh-tien-va-thoi-gian|ADR-0002]] |
| `DATA-03` | Money numeric(19,2), ISO currency, MVP VND | ACCEPTED | MVP | [[adr/0002-postgresql-dinh-danh-tien-va-thoi-gian|ADR-0002]] |
| `DATA-04` | lower_snake_case; clinical/financial/audit không soft-delete | ACCEPTED | MVP | [[adr/0002-postgresql-dinh-danh-tien-va-thoi-gian|ADR-0002]] |
| `DATA-05` | Optimistic lock mặc định; row lock giữ/chốt capacity | ACCEPTED | MVP | [[adr/0003-concurrency-idempotency-inbox-outbox|ADR-0003]] |
| `REL-01` | Idempotency record, webhook inbox, transactional outbox | ACCEPTED | Release 1 | [[adr/0003-concurrency-idempotency-inbox-outbox|ADR-0003]] |
| `REL-02` | Idempotency scope + operation + key + request hash | ACCEPTED | Release 1 | [[adr/0003-concurrency-idempotency-inbox-outbox|ADR-0003]] |
| `IAM-01` | Doctor là PractitionerRole, không có Doctor identity riêng | ACCEPTED | MVP | [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]] |
| `CAT-01` | Department/Room/Service/ServicePrice/PractitionerRole canonical | ACCEPTED | Release 1 | [[21-schema-vat-ly-mvp|Schema]] |
| `NFR-01` | Web responsive cloud | ACCEPTED | MVP | [[12-yeu-cau-phi-chuc-nang|NFR]] |
| `NFR-02` | Tải mục tiêu khoảng 1.000 Visit/ngày | ACCEPTED | MVP | [[12-yeu-cau-phi-chuc-nang#18.2. Hiệu năng và workload|Workload]] |
| `NFR-03` | Không phụ thuộc HIS/LIS/PACS/FHIR ngoài trong MVP | ACCEPTED | MVP | [[12-yeu-cau-phi-chuc-nang|NFR]] |
| `NFR-04` | Có màn hình gọi số; kiosk sau MVP | ACCEPTED | MVP | [[13-ke-hoach-va-nghiem-thu-mvp|MVP]] |
| `NFR-05` | Nhắc Appointment trước 24 giờ khi còn đủ thời gian | ACCEPTED | MVP | [[10-thong-bao|Thông báo]] |
| `NFR-06` | Availability SLO 99.5%/tháng | ACCEPTED | Production MVP | [[12-yeu-cau-phi-chuc-nang#18.3. Sẵn sàng, hạ tầng và khôi phục|SLO]] |
| `NFR-07` | Read p95 <2s, tìm ca p95 <3s tại workload mục tiêu | ACCEPTED | Production MVP | [[12-yeu-cau-phi-chuc-nang#18.2. Hiệu năng và workload|Performance]] |
| `NFR-08` | Queue propagation ≤5 giây bình thường | ACCEPTED | Release 1 | [[12-yeu-cau-phi-chuc-nang#18.2. Hiệu năng và workload|Queue]] |
| `NFR-09` | RPO ≤15 phút, RTO ≤4 giờ | ACCEPTED | Production MVP | [[12-yeu-cau-phi-chuc-nang#18.3. Sẵn sàng, hạ tầng và khôi phục|Recovery]] |
| `NFR-10` | PITR + restore drill có bằng chứng trước production | ACCEPTED | Production MVP | [[12-yeu-cau-phi-chuc-nang#18.3. Sẵn sàng, hạ tầng và khôi phục|Restore]] |
| `NFR-11` | Load test có peak concurrency, mix, p95/p99, error rate và soak | ACCEPTED | Production MVP | [[12-yeu-cau-phi-chuc-nang#18.2. Hiệu năng và workload|Load model]] |
| `DEL-01` | Release 1 là thin operational slice | ACCEPTED | Release 1 | [[22-backlog-mvp#Release 1 — Thin operational slice|Backlog]] |
| `DEL-02` | Story phải đạt Given/When/Then, DoR và DoD | ACCEPTED | Mọi release | [[22-backlog-mvp#Definition of Ready|DoR]] |

### 22.2. Câu hỏi còn mở

| Mã | Câu hỏi | Trạng thái | Owner | Target/Gate | Chặn |
|---|---|---|---|---|---|
| `OPEN-PAY-01` | Chọn provider QR thật, signature/refund/reconciliation contract? | OPEN | Tech lead + Finance | Trước real payment adapter | Không chặn Release 1 mock |
| `OPEN-REF-01` | Priority/SLA/escalation Referral theo vận hành? | OPEN | Clinical operations | Trước Referral tranche đạt DoR | Không chặn Release 1 |
| `OPEN-ORD-02` | Critical Result threshold, acknowledgment và escalation? | OPEN | Clinical safety owner | Trước diagnostics nhận critical test | Không chặn Release 1 |
| `OPEN-REG-01` | Chọn nguồn chính thức/chấp nhận được cho Chương X TT32 và lập sub-matrix? | OPEN | Legal + Clinical Records | Trước HSBA production claim | Chặn TT13-1.2 |

### 22.3. Quyết định deferred

| Mã | Nội dung | Trạng thái | Gate |
|---|---|---|---|
| `EPI-DEFER-01` | Cấp duyệt merge/split Episode | DEFERRED | Sau MVP |
| `INP-DEFER-01` | Waiting list, reservation và transfer bed | DEFERRED | Inpatient tranche sau MVP |

---

## 23. Hướng phát triển sau MVP

- Tách dependent sang account chính chủ nhưng giữ Patient ID/lịch sử.
- Specimen, barcode, LIS/PACS, thiết bị và critical-result workflow đầy đủ.
- Nội trú, giường, điều dưỡng, y lệnh, phẫu thuật và cấp cứu.
- Merge/split Episode nâng cao.
- Kho thuốc/cấp phát, bảo hiểm/BHYT, nhiều bên chi trả và hóa đơn điện tử.
- Kiosk self check-in, mobile native, Referral liên cơ sở.
- Liên thông HL7 FHIR sau mapping/profile/conformance test.

---

## 24. Tóm tắt sản phẩm

```text
Bệnh nhân chọn ca
→ SlotHold 5 phút + PaymentIntent
→ Mock/real payment adapter xác nhận
→ Appointment CONFIRMED
→ Staff CheckIn tạo Visit, Encounter và QueueEntry
→ Bác sĩ ghi ClinicalNote/Diagnosis, xác nhận ServiceDelivery
→ ChargeItem và PaymentAllocation cập nhật BillingAccount
→ Episode/Referral/Order/Result mở rộng theo release gate
```

---

<!-- related-links:start -->
## Liên kết liên quan

- [[docs|Mục lục]]
- [[19-ket-qua-phase-0|Kết quả Phase 0]]
- [[20-so-quyet-dinh-kien-truc|Kiến trúc]]
- [[21-schema-vat-ly-mvp|Schema vật lý]]
- [[22-backlog-mvp|Backlog]]
- [[adr/README|ADR index]]
<!-- related-links:end -->
