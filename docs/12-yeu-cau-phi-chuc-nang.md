---
aliases:
  - Yêu cầu phi chức năng
tags:
  - do-an/ky-thuat
source_sections:
  - 18
---
# Yêu cầu phi chức năng

<!-- obsidian-nav:start -->
[[11-mo-hinh-du-lieu|Phần trước]] · [[docs|Mục lục]] · [[13-ke-hoach-va-nghiem-thu-mvp|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 18. Yêu cầu phi chức năng

### 18.1. Bảo mật, riêng tư và dữ liệu

- HTTPS/TLS ngoài local. Password 12–128 ký tự, hash Argon2id qua Spring Security; chặn common/breached password, không rotation định kỳ.
- OTP email chỉ lưu hash: TTL 10 phút, 5 attempts, resend 60 giây, tối đa 5 lần phát/giờ theo target + source IP; generic response chống account enumeration.
- Opaque session cookie `Secure`, `HttpOnly`, `SameSite=Lax`; CSRF cho unsafe browser request; idle 30 phút, absolute 12 giờ, rotate sau authentication. Năm password failure khóa 15 phút; reset/email change/disable/lock revoke session/token.
- Verification/reset token one-time, hash-at-rest; password reset TTL 30 phút.
- Encryption at rest cho PostgreSQL backup/object storage; key và secret từ secret manager, có rotation.
- RBAC + PractitionerRole + Department + treatment/dependent relation + effective time; default deny.
- Admin/nhân viên hành chính không mặc định xem clinical content.
- Log redaction: không ghi password/OTP/token/payment credential/full clinical payload.
- Evidence upload allowlist MIME/size, checksum, malware scan, private object, signed URL ngắn hạn và download audit.
- Retention clinical/financial/audit/evidence phải được Privacy/Security Owner duyệt trước production; delete không phá immutable history.
- Break-glass có Patient scope, TTL ≤4h, alert và review ≤1 ngày làm việc.

### 18.2. Hiệu năng và workload

Business volume khoảng 1.000 Visit/ngày chưa đủ làm load model. Trước production phải khóa workload profile:

Workload baseline Release 1:

- 200 concurrent browser sessions ở peak; 50 booking/SlotHold commands mỗi phút; burst 20 concurrent requests cho chỗ cuối.
- 100 CheckIn commands mỗi phút trong peak 30 phút; 300 queue-screen connections/pollers.
- 60 Encounter write commands mỗi phút; 100 payment webhook events mỗi phút gồm 20% duplicate/out-of-order trong test reliability.
- Dataset test: 100.000 Patient, 50.000 Appointment, 5.000 Visit/ngày mô phỏng, 30 ngày queue/payment history.
- Read/write mix 70/30; load 30 phút + soak 4 giờ; error rate <1% loại expected 4xx; p99 <5 giây cho read thường.
- Contention test SlotHold chứng minh oversell = 0.

SLO đã khóa:

- Read thông thường p95 <2 giây.
- Tìm ca p95 <3 giây.
- Queue update đến màn hình ≤5 giây trong điều kiện vận hành bình thường.
- Test report phải ghi hardware/config/dataset và so với workload baseline; thay đổi baseline cần `NFR-11` review.

### 18.3. Sẵn sàng, hạ tầng và khôi phục

- Availability SLO 99.5% mỗi tháng cho production MVP, loại planned maintenance đã công bố.
- RPO ≤15 phút; RTO ≤4 giờ là **target thiết kế**, cần owner phê duyệt và restore evidence trước production.
- Hạ tầng theo Điều 2 TT13 phải có inventory từng cơ sở: máy trạm, mạng, máy chủ/compute, primary storage, backup/redundant storage, security controls và thiết bị liên quan.
- PostgreSQL PITR; backup encrypted; backup copy separation/immutability, retention và access policy phải được khóa.
- Restore drill định kỳ có evidence: start/end, recovered point, missing/corrupt records, version-chain check, attestation digest check, attachment checksum và sample retrieval.
- Payment/webhook, queue, Result, identity provider, attestation provider và object storage failures có alert/runbook.
- Email/notification retry có giới hạn, không block transaction chính.
- Provider outage không làm mất PaymentIntent/Inbox; chuyển reconciliation. Identity/signature outage không được publish record như đã ký hợp pháp.

### 18.4. Reliability, concurrency và messaging

- Aggregate mutable dùng optimistic locking.
- AppointmentSlot row lock khi giữ/chốt capacity.
- Idempotency key có principal scope + operation + request hash.
- Webhook inbox dedup/signature status; transactional outbox cùng transaction domain.
- Retry/backoff/dead-letter state observable; correlation ID xuyên API/audit/inbox/outbox.
- State transition invalid trả domain error ổn định và không có side effect.

### 18.5. Khả dụng và accessibility

- Responsive desktop/tablet/mobile.
- Browser matrix được pin trước UAT: hai phiên bản gần nhất Chrome/Edge/Safari; Firefox smoke test.
- Mục tiêu WCAG 2.2 AA: keyboard, focus, contrast, label, error summary.
- Automated accessibility scan + manual keyboard/screen-reader smoke test.
- Queue screen không hiển thị dữ liệu định danh/chuyên môn nhạy cảm.

### 18.6. Toàn vẹn, truy nguyên và truy xuất

- ClinicalNote/Diagnosis R1 `FINALIZED`, lawful-signed Result/content và financial movement bất biến; legal signing evidence cần `ElectronicAttestation` hợp lệ khi signer matrix yêu cầu.
- Episode decision, QueueAdjustment, CheckIn exception, break-glass, refund/reversal, export, conversion và attestation giữ actor, before/after phù hợp, time, reason, version/digest.
- Record retrieval phục vụ điều trị, kiểm tra, thanh tra, nghiên cứu khoa học và quản lý y tế phải có purpose of use, authorization, scope, export/download audit và de-identification/pseudonymization khi phù hợp.
- UTC persistence; display Asia/Ho_Chi_Minh; money numeric(19,2), VND trong MVP.
- Audit append-only và có authorization riêng.

### 18.7. Observability

- Structured logs, metrics và distributed trace/correlation ID.
- Metrics tối thiểu: API latency/error, DB pool, lock wait, SlotHold conflict, queue propagation, inbox/outbox lag, webhook invalid/failed, notification retry, restore status.
- Alert có owner, severity và runbook; không alert chỉ bằng log text.
- Dashboard vận hành không trộn KPI nghiệp vụ với SLO kỹ thuật.

### 18.8. Triển khai và module boundary

- React frontend + Spring Boot modular monolith + PostgreSQL theo [[20-so-quyet-dinh-kien-truc|Architecture baseline]].
- Spring Modulith test boundary; module không dùng JPA entity module khác.
- MVP không phụ thuộc HIS/LIS/PACS/FHIR ngoài.
- Compliance chỉ tuyên bố sau [[23-ma-tran-yeu-cau-tt13-2025|requirement matrix]], Chương X TT32 mapping, triển khai, conformance/restore/retrieval evidence và owner approval. Tiêu chuẩn kỹ thuật CNTT cơ quan nhà nước tại TT13 Điều 2.3 phải có catalog áp dụng do Legal/Architecture Owner xác định; chưa ghi là đã đáp ứng.
- CI gate tương lai: compile, unit/integration, Modulith, migration smoke, OpenAPI diff, security/static scan.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[07-phan-quyen|Bảo mật/RBAC]]
- [[11-mo-hinh-du-lieu|Toàn vẹn logic]]
- [[21-schema-vat-ly-mvp|Schema vật lý]]
- [[adr/0003-concurrency-idempotency-inbox-outbox|Concurrency/reliability ADR]]
- [[22-backlog-mvp#Definition of Done|DoD]]
- [[23-ma-tran-yeu-cau-tt13-2025|Ma trận TT13]]
<!-- related-links:end -->
