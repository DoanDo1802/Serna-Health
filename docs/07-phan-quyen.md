---
aliases:
  - Phân quyền
tags:
  - do-an/bao-mat
source_sections:
  - 11
---
# Phân quyền

<!-- obsidian-nav:start -->
[[06-ho-so-suc-khoe-va-kham|Phần trước]] · [[docs|Mục lục]] · [[08-dashboard-quan-ly|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 11. Phân quyền theo action và context

### Mô hình quyết định quyền

```text
authorize = permission(resource.action)
            + effective role/practitioner role
            + department scope
            + treatment/dependent relationship
            + effective time
            + resource state guards
```

Default deny. Role là bundle permission, không hard-code role name trong domain service.

### Action matrix tối thiểu

| Action | Actor/role thường dùng | Context guard |
|---|---|---|
| `account.register` | Anonymous requester | Email normalization + anti-enumeration + rate limit |
| `account.authenticate` | Account principal | Credential/challenge/session state + lockout |
| `account.recover` | Account owner | One-time token + anti-enumeration + session revocation |
| `account.manage_role` | Authorized admin | Approval/separation policy + effective interval + audit |
| `appointment.create` | Patient/Representative, Receptionist | Patient scope + capacity |
| `checkin.execute` | Receptionist | Own department + window/exception |
| `queue.adjust` | QueueCoordinator | Department + reason |
| `encounter.write` | Doctor | Treatment relation + department |
| `clinical.note.finalize` | Authorized Practitioner | R1 author/finalizer + DRAFT + canonical digest |
| `diagnosis.finalize` | Authorized Practitioner | R1 author/finalizer + DRAFT + canonical digest |
| `clinical.note.sign` | Authorized Practitioner | Lawful tranche only: signer capacity + target version/digest + method |
| `diagnosis.sign` | Authorized Practitioner khi mapping yêu cầu | Lawful tranche only: signer capacity + target version/digest + method |
| `prescription.sign` | Authorized prescriber | MVP-LATER: effective PractitionerRole + attestation |
| `clinical.version.amend` | Authorized Practitioner | Previous FINALIZED version + reason; lawful tranche cần attestation mới |
| `clinical.version.publish` | Authorized publisher | Lawful tranche only: valid attestation + state guard |
| `episode.manage` | Doctor/CareCoordinator | CareTeam/effective assignment |
| `order.create` | Doctor | Order type permission |
| `order.sign` | Authorized requester | Order type + valid attestation |
| `result.author.lab` | Technician/Practitioner | Laboratory + department |
| `result.author.imaging` | Technician/Radiologist | Imaging + department |
| `result.finalize.lab` | LabApprover | Effective role + attestation |
| `result.finalize.imaging` | Radiologist | Effective role + attestation |
| `billing.charge.create` | Cashier/system service | ServiceDelivery guard |
| `financial.adjust.propose` | Cashier | Payment/ChargeItem scope |
| `financial.adjust.approve` | FinanceApprover | Different account from proposer |
| `clinical.attachment.upload` | Authorized clinical actor | Owner resource/version + MIME/scan guard |
| `clinical.attachment.read` | Treatment/dependent actor | Owner resource authorization + download audit |
| `identity.link.verify` | Authorized identity staff/system | Source/evidence + mismatch/revoke guard |
| `record.export` | ClinicalRecordsManager/authorized requester | Purpose + approval + scope + export audit |
| `legacy_record.convert` | Records operator | Approved batch + chain of custody |
| `legacy_record.review` | Records reviewer | Different operator where policy requires |
| `clinical.break_glass` | Doctor | Patient scope + purpose + TTL |
| `audit.read` | SecurityAuditor/authorized manager | Audit scope |

Admin cấu hình role/permission nhưng không mặc định nhận quyền chuyên môn hoặc ký FINAL.

### Separation of duties

- KTV nhập PRELIMINARY không mặc định được ký FINAL; quyền author tách `lab`/`imaging`.
- Người ghi, người ký/xác nhận và người publish là capability riêng; có thể cùng principal chỉ khi mọi permission/capacity đều hợp lệ.
- Dependent verification hoặc OTP consent không tự tạo signer capacity cho clinical content.
- Refund/Reversal proposer không được approve cùng request.
- Role assignment và permission escalation cần actor khác hoặc policy approval.
- Break-glass không cấp quyền tài chính hoặc quản trị.

### Treatment và dependent scope

- Practitioner access dựa Encounter/CareTeam/ResponsibleDoctorAssignment có hiệu lực.
- 30 ngày hậu kiểm tính từ khi quan hệ cuối cùng kết thúc; action được phép vẫn tách read/amend/sign.
- Dependent scope theo Tier 0/1/2 tại [[06-ho-so-suc-khoe-va-kham#10.2. Dependent và verification tiers|Verification tiers]].
- Revoked/expired link có hiệu lực ngay với request mới và notification chưa gửi.

### Break-glass và hậu kiểm

BreakGlassGrant bắt buộc:

- Patient ID, purpose of use và reason.
- Requester account/role snapshot; grantor account hoặc policy mechanism.
- `requested_at`, `granted_at`, `effective_from`, `expires_at` tối đa 4 giờ.
- Correlation/request/session ID và alert/ticket reference.
- Alert SecurityAuditor; reviewer account, `reviewed_at`, outcome và review reason trong 1 ngày làm việc.
- Auto-expiry; không gia hạn im lặng.

### Audit contract

AuditEvent append-only lưu:

- actor type/account và effective-role snapshot;
- purpose of use và authorization basis;
- resource type/ID/version/digest và Patient scope khi có;
- action, outcome, reason, source system/event;
- before/after redacted phù hợp;
- session/request/correlation ID;
- export/download indicator, recipient/channel khi có;
- reviewer/approval metadata cho break-glass, export và conversion;
- source IP/device/network metadata đã redacted theo policy;
- timestamp UTC.

Không log password, OTP secret, raw token, private key, raw biometric sample/template, full payment credential hoặc clinical payload nhạy cảm. Audit retention cụ thể là production privacy gate.

Chi tiết schema: [[21-schema-vat-ly-mvp#Identity, RBAC và audit|Identity/RBAC]]. Quyết định: [[adr/0004-actor-rbac-audit-va-dependent-privacy|ADR-0004]].

---

<!-- related-links:start -->
## Liên kết liên quan

- [[02-tac-nhan-va-chuc-nang|Tác nhân]]
- [[06-ho-so-suc-khoe-va-kham|Hồ sơ/dependent]]
- [[12-yeu-cau-phi-chuc-nang|Bảo mật NFR]]
- [[14-gia-dinh-cau-hoi-va-dinh-huong#22.1. Quyết định đã chốt|Decision register]]
<!-- related-links:end -->
