---
aliases:
  - Kế hoạch và nghiệm thu MVP
tags:
  - do-an/mvp
source_sections:
  - 19
  - 20
---
# Kế hoạch và nghiệm thu MVP

<!-- obsidian-nav:start -->
[[12-yeu-cau-phi-chuc-nang|Phần trước]] · [[docs|Mục lục]] · [[14-gia-dinh-cau-hoi-va-dinh-huong|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 19. Phạm vi MVP đề xuất

### 19.1. Full MVP capability boundary

Full MVP vẫn gồm:

- React/Spring Boot/PostgreSQL platform, identity/catalog, RBAC/audit.
- Scheduling, SlotHold, Appointment, staff CheckIn, queue và walk-in.
- Visit/Encounter đa chuyên khoa, ClinicalNote, Diagnosis, Prescription.
- Episode/CareTeam/Referral.
- Order/Result laboratory/imaging không critical.
- BillingAccount, ServiceDelivery, ChargeItem, cash/QR, refund/reversal.
- Dependent online, notification và dashboard.

Sau MVP: self check-in kiosk/web nâng cao, Specimen/LIS/PACS, critical workflow đầy đủ, inpatient/bed, insurance, FHIR integration ngoài.

### 19.2. Release 1 — Thin operational slice

Release 1 không phải toàn bộ MVP. Luồng bắt buộc:

```text
Catalog/identity
→ Patient
→ AppointmentSlot + SlotHold
→ mock PaymentIntent/Payment
→ Appointment
→ staff CheckIn
→ Visit + Encounter + Queue
→ ClinicalNote/Diagnosis tối thiểu
→ ServiceDelivery + ChargeItem
→ cash/mock PaymentAllocation
→ complete Encounter/Visit/BillingAccount
→ audit/outbox
```

Không thuộc Release 1: real QR provider, dependent tier nâng cao, Episode/Referral, diagnostics, dashboard đầy đủ, refund UI và inpatient.

### 19.3. Phase 0 exit / Phase 1 entry gate

Phase 1 chỉ bắt đầu khi:

- Readiness ≥85/100 và binary gate đạt.
- 0 blocker OPEN cho Release 1.
- 0 literal placeholder chưa định danh.
- 0 broken wiki link/Mermaid parse error.
- Physical schema bao phủ mọi entity Release 1.
- 100% Release 1 story đạt [[22-backlog-mvp#Definition of Ready|DoR]].
- Blocker trace Decision → ADR → ERD → schema → scenario đầy đủ.

Kết quả gate canonical tại [[19-ket-qua-phase-0|Kết quả Phase 0]].

---

## 20. Tiêu chí nghiệm thu MVP

### Release 1 booking/payment

- SlotHold hết hạn không tạo Appointment.
- Concurrency không vượt capacity; FULFILLED vẫn giữ reservation.
- PaymentIntent liên kết SlotHold trước Appointment.
- Success hợp lệ tạo đúng một Payment/Appointment; duplicate/out-of-order retry không tạo trùng.
- Late success không còn reservation chuyển reconciliation/refund, không oversell.
- Reschedule tạo Appointment mới và lineage; lịch cũ RESCHEDULED.

### Release 1 CheckIn/queue/Visit

- Chỉ staff có permission CheckIn trong Release 1.
- CheckIn retry trả cùng Visit/Encounter/QueueEntry.
- CheckIn ngoại lệ cần reason/audit.
- NO_SHOW chỉ từ CONFIRMED chưa CheckIn/Visit.
- Queue state/number/adjustment deterministic; default ratio 3 hiện tại : 1 tồn.
- Tối đa một QueueEntry active mỗi Encounter.
- Visit completion chặn active Encounter/Queue/pending same-day Referral; open Order/billing chỉ warning.

### Release 1 clinical/billing

- ClinicalNote/Diagnosis `FINALIZED` không ghi đè; amendment tạo DRAFT version mới. Đây là technical immutability acceptance. State/action `SIGNED`/`sign` chỉ active khi lawful-signing tranche có `ElectronicAttestation` hợp lệ theo ADR-0008 và `SIGN-01` đã đóng.
- Diagnosis có code hoặc free text, author/provenance/version.
- Một ServiceDelivery PERFORMED tạo tối đa một original ChargeItem.
- Charge amount giữ price/discount snapshot; replay không double-charge.
- Mỗi Visit đúng một BillingAccount.
- Ledger capture/refund không trừ hai lần.
- BillingAccount chỉ close khi guards đạt; reopen có permission/reason/audit.

### Security/reliability

- Negative authorization test cho từng action nhạy cảm.
- Proposer không tự approve financial adjustment.
- Break-glass Patient-scoped, TTL và review/audit.
- Idempotency key khác payload bị từ chối.
- Audit/inbox/outbox có correlation ID.
- Slot contention test oversell = 0.
- Restore drill đạt RPO/RTO trước production.
- Identity mismatch/revoke, attestation failure, invalid signer capacity, attachment access và export/download đều có negative tests.

### Release later gates

- Dependent: Tier/scope/evidence/privacy tests trước tranche.
- Referral: `OPEN-REF-01` đóng trước SLA/escalation stories.
- Diagnostics: signer matrix đã khóa; `OPEN-ORD-02` đóng hoặc catalog loại critical tests.
- Real QR: `OPEN-PAY-01` đóng, provider sandbox/contract/reconciliation tests đạt.

### Legal/operational production gate

- [[23-ma-tran-yeu-cau-tt13-2025|Ma trận TT13]] không còn `GAP`, `NOT_ASSESSED` hoặc `EVIDENCE_PENDING` cho requirement chặn production.
- Chương X TT32 có mapping chính thức: field/mẫu/signer → UI/API/schema/test/evidence.
- Mọi target version cần ký có `ElectronicAttestation` hợp lệ, verifier/provider approved và revoke/mismatch tests đạt.
- Record retrieval drill đạt purpose/authorization/time/integrity; export/download có manifest/checksum/audit.
- Restore drill đạt RPO/RTO và logical integrity sau restore.
- Hồ sơ giấy chuyển tiếp/conversion có quyết định, batch, checksum, chain of custody và exception report.
- [[24-khung-quy-che-van-hanh-hsba-dien-tu|Quy chế]] đã được ban hành, có số/ngày hiệu lực và training evidence.
- `NOT_APPLICABLE_APPROVED` đều có lý do, người duyệt và ngày duyệt.

Story-level Given/When/Then và trace IDs nằm tại [[22-backlog-mvp|Backlog MVP]], không sao chép ở đây.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[19-ket-qua-phase-0|Kết quả Phase 0]]
- [[20-so-quyet-dinh-kien-truc|Kiến trúc]]
- [[21-schema-vat-ly-mvp|Schema]]
- [[22-backlog-mvp|Backlog, DoR, DoD]]
- [[14-gia-dinh-cau-hoi-va-dinh-huong#22.1. Quyết định đã chốt|Decision register]]
<!-- related-links:end -->
