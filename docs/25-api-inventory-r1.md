---
aliases:
  - API inventory Release 1
artifact_type: api-inventory
status: ACCEPTED
---
# API inventory Release 1

<!-- obsidian-nav:start -->
[[24-khung-quy-che-van-hanh-hsba-dien-tu|Phần trước]] · [[docs|Mục lục]]
<!-- obsidian-nav:end -->

OpenAPI source: `contracts/openapi/openapi.yaml`. Bundle consumer: `contracts/openapi/medicore.openapi.yaml`. Quy ước: [[adr/0013-api-contract-versioning-error-idempotency|ADR-0013]].

## Quy ước chung

- Base `/api/v1`; session cookie `MEDICORE_SESSION`; unsafe browser command cần `X-CSRF-Token`.
- Create/retry-risk command cần `Idempotency-Key`; mutable transition cần `If-Match`; response mutable trả ETag.
- Error `application/problem+json` có stable `code`, request/correlation IDs, field errors và blockers.
- List dùng opaque cursor. Money là decimal string + `VND`; instant ISO-8601 có offset.
- Mọi operation trace owner, permission, audit action, story và scenario trong `x-medicore-*`.

## Identity access — R1-02

| Method/path | operationId | Security/guard |
|---|---|---|
| `POST /auth/registrations` | `registerAccount` | Public; idempotent; anti-enumeration/rate limit |
| `POST /auth/email-verification-challenges` | `requestEmailVerification` | Public/optional session; generic 202 |
| `POST /auth/email-verifications` | `verifyEmail` | Public; one-time code/token; idempotent |
| `POST /auth/password-sessions` | `loginWithPassword` | Public; lockout; set session/CSRF |
| `POST /auth/otp-challenges` | `requestLoginOtp` | Public; generic 202/rate limit |
| `POST /auth/otp-sessions` | `loginWithOtp` | Public; consume OTP; rotate session |
| `GET /auth/session` | `getCurrentSession` | Session principal |
| `DELETE /auth/session` | `logoutCurrentSession` | Session + CSRF |
| `DELETE /auth/sessions` | `logoutAllSessions` | Session + CSRF + idempotency |
| `POST /auth/password-recovery-challenges` | `requestPasswordRecovery` | Public; generic 202 |
| `POST /auth/password-resets` | `resetPassword` | Public one-time token; idempotent; revoke sessions |
| `PUT /auth/password` | `changePassword` | Session + CSRF + If-Match |
| `GET /admin/accounts` | `listAccounts` | `account.read` |
| `GET /admin/accounts/{accountId}` | `getAccount` | `account.read` |
| `POST /admin/accounts/{accountId}/actions/change-status` | `changeAccountStatus` | `account.status.change`; idempotency + If-Match + reason |
| `GET /admin/roles` | `listRoles` | `role.read` |
| `POST /admin/roles` | `createRole` | `role.create`; idempotent |
| `GET /admin/permissions` | `listPermissions` | `permission.read` |
| `PUT /admin/roles/{roleId}/permissions` | `replaceRolePermissions` | `role.permission.manage`; If-Match |
| `GET /admin/accounts/{accountId}/role-assignments` | `listAccountRoleAssignments` | `account.role.read` |
| `POST /admin/accounts/{accountId}/role-assignments` | `assignAccountRole` | `account.manage_role`; idempotent |
| `POST /admin/role-assignments/{assignmentId}/actions/revoke` | `revokeAccountRoleAssignment` | `account.manage_role`; If-Match |

## Platform audit — R1-02

| Method/path | operationId | Security/guard |
|---|---|---|
| `POST /patients/{patientId}/break-glass-grants` | `requestBreakGlassGrant` | `clinical.break_glass`; purpose/reason/TTL; idempotent |
| `GET /break-glass-grants` | `listBreakGlassGrants` | `audit.read` hoặc requester scope |
| `POST /break-glass-grants/{grantId}/actions/revoke` | `revokeBreakGlassGrant` | scoped owner/security; If-Match |
| `POST /break-glass-grants/{grantId}/actions/review` | `reviewBreakGlassGrant` | `audit.break_glass.review`; If-Match |
| `GET /audit-events` | `listAuditEvents` | `audit.read`; time/scope filter + cursor |
| `GET /audit-events/{auditEventId}` | `getAuditEvent` | `audit.read`; redacted detail |

## Catalog — R1-03

| Resource | Query operations | Admin commands |
|---|---|---|
| Department | `listDepartments`, `getDepartment` | `createDepartment`, `updateDepartment`, `deactivateDepartment` |
| Room | `listRooms`, `getRoom` | `createRoom`, `updateRoom`, `deactivateRoom` |
| Service | `listServices`, `getService` | `createService`, `updateService`, `deactivateService` |
| ServicePrice | `listServicePrices`, `getServicePrice` | `createServicePrice`, `endServicePrice` |
| Practitioner | `listPractitioners`, `getPractitioner` | `createPractitioner`, `updatePractitioner`, `deactivatePractitioner` |
| PractitionerRole | `listPractitionerRoles`, `getPractitionerRole` | `assignPractitionerRole`, `revokePractitionerRole` |

Collection path là plural resource; price/role create nằm dưới owner resource. Create cần idempotency; update/action cần If-Match. Không DELETE catalog đã tham chiếu.

## Patient — R1-04

| Method/path | operationId | Security/guard |
|---|---|---|
| `POST /patients` | `createPatient` | patient-self/reception; idempotent |
| `GET /patients` | `searchPatients` | authorized staff; constrained search |
| `GET/PATCH /patients/{patientId}` | `getPatient` / `updatePatient` | patient/dependent/treatment/admin scope; PATCH If-Match |
| `GET/POST /patients/{patientId}/identifiers` | `listPatientIdentifiers` / `addPatientIdentifier` | scoped read; write-only protected full value |
| `POST /patient-identifiers/{identifierId}/actions/verify-manually` | `verifyPatientIdentifierManually` | identity staff; If-Match/evidence/reason |
| `POST /patient-identifiers/{identifierId}/actions/revoke` | `revokePatientIdentifier` | identity staff; If-Match/reason |
| `GET/POST /patients/{patientId}/account-links` | `listPatientAccountLinks` / `linkPatientAccount` | scoped own/basic R1 link |
| `GET /patient-duplicate-candidates` | `listPatientDuplicateCandidates` | authorized reviewer |
| `GET /patient-duplicate-candidates/{candidateId}` | `getPatientDuplicateCandidate` | authorized reviewer |
| `POST /patient-duplicate-candidates/{candidateId}/actions/review` | `reviewPatientDuplicateCandidate` | If-Match; CONFIRMED/REJECTED; không merge |

## Scheduling và payment — R1-05..07

| Method/path | operationId | Guard |
|---|---|---|
| `GET /appointment-slots` | `searchAppointmentSlots` | public/session availability projection |
| `GET /appointment-slots/{slotId}` | `getAppointmentSlot` | public/session |
| `POST /appointment-slots` | `createAppointmentSlot` | admin; idempotent; overlap/shift limit |
| `PATCH /appointment-slots/{slotId}` | `updateAppointmentSlot` | admin; If-Match; reservation-safe |
| `POST /appointment-slots/{slotId}/actions/cancel` | `cancelAppointmentSlot` | admin; If-Match/reason |
| `POST /slot-holds` | `createSlotHold` | patient/reception; idempotent/capacity lock |
| `GET /slot-holds/{holdId}` | `getSlotHold` | owner/staff |
| `DELETE /slot-holds/{holdId}` | `cancelSlotHold` | owner/staff; CSRF + If-Match |
| `POST /slot-holds/{holdId}/payment-intents` | `createPaymentIntent` | owner/staff; idempotent |
| `GET /payment-intents/{paymentIntentId}` | `getPaymentIntent` | owner/staff |
| `POST /webhooks/payments/{provider}` | `receivePaymentWebhook` | provider signature + event dedup; generic 202 |
| `POST /mock-payment-intents/{paymentIntentId}/actions/simulate` | `simulateMockPaymentOutcome` | local/test only |
| `GET /appointments` | `listAppointments` | own patient/staff filters |
| `GET /appointments/{appointmentId}` | `getAppointment` | owner/staff |
| `POST /appointments/{appointmentId}/actions/reschedule` | `rescheduleAppointment` | idempotent + If-Match; funding/lineage atomic |
| `POST /appointments/{appointmentId}/actions/cancel` | `cancelAppointment` | idempotent + If-Match; policy outcome |
| `POST /appointments/{appointmentId}/actions/mark-no-show` | `markAppointmentNoShow` | staff/job; If-Match/state guard |

Không có direct `POST /appointments`; Appointment chỉ sinh từ valid payment/zero-payment workflow.

## Reception, queue, Visit, Encounter — R1-08..09, R1-13

| Group | Operations |
|---|---|
| CheckIn | `checkInAppointment`, `getCheckIn` |
| Visit | `listVisits`, `getVisit`, `completeVisit`, `cancelVisit`, `enterVisitInError` |
| Encounter | `listVisitEncounters`, `getEncounter`, `startEncounter`, `completeEncounter`, `cancelEncounter`, `enterEncounterInError` |
| Queue | `listQueueEntries`, `getQueueEntry`, `callQueueEntry`, `startQueueService`, `deferQueueEntry`, `returnQueueEntryToWaiting`, `completeQueueEntry`, `cancelQueueEntry`, `enterQueueEntryInError`, `adjustQueueEntry` |
| Queue policy/screen | `getQueuePolicy`, `putQueuePolicy`, `getQueueScreen` |

CheckIn/adjust/complete commands có idempotency khi retry risk; transitions dùng If-Match. Queue screen là privacy-safe projection và conditional GET; không chứa tên đầy đủ hoặc clinical data.

## Clinical và ServiceDelivery — R1-10..11

| Group | Operations |
|---|---|
| ClinicalNote | `listEncounterClinicalNotes`, `createClinicalNote`, `getClinicalNote`, `listClinicalNoteVersions`, `getClinicalNoteVersion`, `updateClinicalNoteDraft`, `finalizeClinicalNoteVersion`, `amendClinicalNoteVersion`, `enterClinicalNoteVersionInError` |
| Diagnosis | `listEncounterDiagnoses`, `createDiagnosis`, `getDiagnosis`, `listDiagnosisVersions`, `getDiagnosisVersion`, `updateDiagnosisDraft`, `finalizeDiagnosisVersion`, `amendDiagnosisVersion`, `enterDiagnosisVersionInError` |
| ServiceDelivery | `listEncounterServiceDeliveries`, `createServiceDelivery`, `getServiceDelivery`, `performServiceDelivery`, `cancelServiceDelivery`, `enterServiceDeliveryInError` |

Draft update/transition cần If-Match; create/finalize/amend/perform retry-safe dùng idempotency. Không có sign/publish/attestation API trong R1.

## Billing — R1-11..13

| Method/path | operationId | Guard |
|---|---|---|
| `GET /visits/{visitId}/billing-account` | `getVisitBillingAccount` | billing scope |
| `GET /billing-accounts/{accountId}` | `getBillingAccount` | billing scope |
| `GET /billing-accounts/{accountId}/ledger` | `listBillingLedgerEntries` | cursor; immutable projection |
| `GET /billing-accounts/{accountId}/charges` | `listBillingAccountCharges` | billing scope |
| `GET /charge-items/{chargeItemId}` | `getChargeItem` | billing scope |
| `POST /payments` | `recordCounterPayment` | Cashier; cash/mock only; idempotent |
| `GET /payments` | `listPayments` | authorized filter/cursor |
| `GET /payments/{paymentId}` | `getPayment` | authorized |
| `POST /billing-accounts/{accountId}/payment-allocations` | `allocatePayment` | Cashier/system; idempotent + If-Match |
| `GET /billing-accounts/{accountId}/payment-allocations` | `listPaymentAllocations` | billing scope |
| `POST /billing-accounts/{accountId}/actions/close` | `closeBillingAccount` | idempotent + If-Match; blocker list |
| `POST /billing-accounts/{accountId}/actions/reopen` | `reopenBillingAccount` | manager; If-Match/reason |

ChargeItem do internal ServiceDelivery event tạo; không public create endpoint. Refund/reversal API nằm release sau.

## Notification và ops — R1-14

| Method/path | operationId | Guard |
|---|---|---|
| `GET /notifications` | `listMyNotifications` | current account, cursor, minimum data |
| `GET /notifications/{notificationId}` | `getMyNotification` | recipient scope |
| `POST /notifications/{notificationId}/actions/cancel` | `cancelNotification` | pending only; If-Match |

Outbox/inbox/retry/dead-letter là internal worker, không public API. `/actuator/health` nằm ngoài domain spec; metrics không expose cho browser.

## Trace theo story

| Story | OpenAPI tag/module | Scenarios |
|---|---|---|
| `R1-02` | IdentityAccess, PlatformAudit | `SC-R1-AUTH-01..03`, `SC-R1-SEC-01`, `SC-R1-REL-01` |
| `R1-03` | Catalog | catalog constraints trong story tests |
| `R1-04` | Patient | `SC-R1-PAT-01` |
| `R1-05..07` | SchedulingPayment | `SC-R1-BOOK-01..04`, `SC-R1-PAY-01..02`, `SC-R1-RESCHEDULE-01..02` |
| `R1-08..09` | ReceptionQueue | `SC-R1-CHECKIN-01..02`, `SC-R1-QUEUE-01` |
| `R1-10` | ClinicalCare | `SC-R1-CLIN-01..02` |
| `R1-11..13` | BillingPayment | `SC-R1-BILL-01..02` |
| `R1-14` | Notification | reliability/notification tests phải bổ sung khi coding story |

---

<!-- related-links:start -->
## Liên kết liên quan

- [[20-so-quyet-dinh-kien-truc|Architecture]]
- [[21-schema-vat-ly-mvp|Physical schema]]
- [[22-backlog-mvp|Backlog R1]]
- [[adr/0013-api-contract-versioning-error-idempotency|ADR-0013]]
<!-- related-links:end -->
