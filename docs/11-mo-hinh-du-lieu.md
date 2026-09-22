---
aliases:
  - Mô hình dữ liệu
tags:
  - do-an/du-lieu
source_sections:
  - 16
---
# Mô hình dữ liệu

<!-- obsidian-nav:start -->
[[10-thong-bao|Phần trước]] · [[docs|Mục lục]] · [[12-yeu-cau-phi-chuc-nang|Phần tiếp theo]]
<!-- obsidian-nav:end -->

## 16. Mô hình dữ liệu khái niệm

> [!IMPORTANT]
> Đây là ERD logic, không phải DDL. Kiểu PostgreSQL, nullability, constraint và index canonical nằm tại [[21-schema-vat-ly-mvp|Schema vật lý MVP]]. Migration chỉ được sinh từ schema vật lý đã ACCEPTED và ADR liên quan.

**Quy ước logic:** `identifier`, `code`, `string`, `text`, `date`, `instant`, `integer`, `amount`, `boolean`, `json`; `PK`, `FK`, `UK` là khóa logic. Nội dung chưa triển khai mang Decision ID `OPEN` hoặc `DEFERRED`.

Doctor là PractitionerRole của Practitioner theo `IAM-01`. Entity biên chỉ hiện khóa.

### 16.1. Lập kế hoạch, ca khám và cung cấp chăm sóc

```mermaid
erDiagram
    PRACTITIONER {
        identifier id PK
        identifier user_account_id FK, UK
        string staff_code UK
        string full_name
        boolean active
    }
    PRACTITIONER_ROLE {
        identifier id PK
        identifier practitioner_id FK
        identifier department_id FK
        code role_code
        instant effective_from
        instant effective_to
    }
    DEPARTMENT {
        identifier id PK
        string code UK
        string name
        boolean active
    }
    ROOM {
        identifier id PK
        identifier department_id FK
        string code UK
        string name
        boolean active
    }
    SERVICE {
        identifier id PK
        string code UK
        string name
        boolean active
    }
    APPOINTMENT_SLOT {
        identifier id PK
        identifier practitioner_role_id FK
        identifier department_id FK
        identifier room_id FK
        identifier service_id FK
        code session
        instant start_at
        instant end_at
        integer capacity
        integer version
    }
    SLOT_HOLD {
        identifier id PK
        identifier appointment_slot_id FK
        identifier patient_id FK
        instant expires_at
        amount deposit_snapshot
        code currency
        string idempotency_key
        code status
    }
    PAYMENT_INTENT {
        identifier id PK
        identifier slot_hold_id FK, UK
        string provider
        string provider_reference UK
        amount requested_amount
        code currency
        code status
    }
    PATIENT {
        identifier id PK
    }
    APPOINTMENT {
        identifier id PK
        identifier patient_id FK
        identifier slot_hold_id FK, UK
        identifier rescheduled_from_id FK
        identifier rescheduled_to_id FK
        code status
        integer version
    }
    CHECK_IN {
        identifier id PK
        identifier appointment_id FK, UK
        identifier visit_id FK, UK
        identifier actor_account_id FK
        code channel
        instant occurred_at
        boolean exception
        text exception_reason
        string idempotency_key UK
    }
    VISIT {
        identifier id PK
        identifier patient_id FK
        identifier appointment_id FK, UK
        code visit_type
        code status
        integer version
    }
    ENCOUNTER {
        identifier id PK
        identifier visit_id FK
        identifier department_id FK
        identifier room_id FK
        instant start_at
        instant end_at
        code status
        integer version
    }
    QUEUE_POLICY {
        identifier id PK
        identifier department_id FK
        integer current_ratio
        integer carry_over_ratio
        instant effective_from
        instant effective_to
        integer version
    }
    QUEUE_ENTRY {
        identifier id PK
        identifier encounter_id FK
        identifier queue_policy_id FK
        identifier department_id FK
        identifier room_id FK
        date service_date
        integer queue_number
        instant checked_in_at
        instant called_at
        instant service_started_at
        instant completed_at
        code status
        integer version
    }
    QUEUE_ADJUSTMENT {
        identifier id PK
        identifier queue_entry_id FK
        identifier actor_account_id FK
        json before_value
        json after_value
        instant adjusted_at
        text reason
    }
    ENCOUNTER_PARTICIPANT {
        identifier id PK
        identifier encounter_id FK
        identifier practitioner_role_id FK
        code participant_type
        instant effective_from
        instant effective_to
        code status
    }

    PRACTITIONER ||--o{ PRACTITIONER_ROLE : "có vai trò"
    DEPARTMENT ||--o{ PRACTITIONER_ROLE : "phân công"
    PRACTITIONER_ROLE ||--o{ APPOINTMENT_SLOT : "có ca"
    DEPARTMENT ||--o{ APPOINTMENT_SLOT : "mở ca"
    ROOM o|--o{ APPOINTMENT_SLOT : "phòng dự kiến"
    SERVICE ||--o{ APPOINTMENT_SLOT : "cung cấp"
    APPOINTMENT_SLOT ||--o{ SLOT_HOLD : "được giữ"
    PATIENT ||--o{ SLOT_HOLD : "giữ chỗ"
    SLOT_HOLD ||--o| PAYMENT_INTENT : "checkout"
    SLOT_HOLD ||--o| APPOINTMENT : "tạo"
    PATIENT ||--o{ APPOINTMENT : "có lịch"
    APPOINTMENT o|--o| VISIT : "có thể dẫn đến"
    APPOINTMENT o|--o| APPOINTMENT : "reschedule"
    APPOINTMENT ||--o| CHECK_IN : "được check-in"
    CHECK_IN ||--|| VISIT : "tạo hoặc lấy"
    PATIENT ||--o{ VISIT : "được tiếp nhận"
    VISIT ||--o{ ENCOUNTER : "gồm"
    ENCOUNTER ||--o{ ENCOUNTER_PARTICIPANT : "có participant"
    PRACTITIONER_ROLE ||--o{ ENCOUNTER_PARTICIPANT : "tham gia"
    ENCOUNTER ||--o{ QUEUE_ENTRY : "lịch sử queue"
    QUEUE_POLICY ||--o{ QUEUE_ENTRY : "điều phối"
    ROOM o|--o{ QUEUE_ENTRY : "gọi tại"
    QUEUE_ENTRY ||--o{ QUEUE_ADJUSTMENT : "điều chỉnh"
```

Capacity tính SlotHold ACTIVE và Appointment còn giữ reservation, gồm CONFIRMED/FULFILLED. CheckIn không giải phóng chỗ. Chỉ CONFIRMED chưa CheckIn/Visit mới NO_SHOW. Một Encounter tối đa một QueueEntry active. QueuePolicy mặc định 3 hiện tại : 1 tồn theo `QUEUE-07`.

### 16.1.1. Hồ sơ lâm sàng ngoại trú và attestation

```mermaid
erDiagram
    PATIENT ||--o{ HEALTH_BASELINE_ENTRY : "có thông tin nền"
    HEALTH_BASELINE_ENTRY ||--o{ HEALTH_BASELINE_VERSION : "giữ version"
    ENCOUNTER ||--o{ CLINICAL_NOTE : "có note"
    CLINICAL_NOTE ||--o{ CLINICAL_NOTE_VERSION : "giữ version"
    ENCOUNTER ||--o{ DIAGNOSIS : "có chẩn đoán"
    DIAGNOSIS ||--o{ DIAGNOSIS_VERSION : "giữ version"
    ENCOUNTER ||--o{ PRESCRIPTION : "có đơn"
    PRESCRIPTION ||--|{ PRESCRIPTION_ITEM : "gồm"
    CLINICAL_ATTACHMENT ||--o{ CLINICAL_ATTACHMENT_LINK : "được liên kết"
    ELECTRONIC_ATTESTATION }o--|| CLINICAL_NOTE_VERSION : "có thể xác nhận"
    ELECTRONIC_ATTESTATION }o--|| DIAGNOSIS_VERSION : "có thể xác nhận"
    ELECTRONIC_ATTESTATION }o--|| PRESCRIPTION : "có thể xác nhận"

    HEALTH_BASELINE_ENTRY {
        identifier id PK
        identifier patient_id FK
        code category
        identifier current_version_id FK
    }
    HEALTH_BASELINE_VERSION {
        identifier id PK
        identifier entry_id FK
        identifier previous_version_id FK
        code source
        code verification_status
        identifier author_role_id FK
        identifier verifier_role_id FK
        json coded_value
        text narrative
        instant effective_from
        instant effective_to
    }
    CLINICAL_NOTE {
        identifier id PK
        identifier encounter_id FK
        code note_type
        identifier current_version_id FK
    }
    CLINICAL_NOTE_VERSION {
        identifier id PK
        identifier note_id FK
        identifier previous_version_id FK
        identifier author_role_id FK
        code status
        json content
        text reason
    }
    DIAGNOSIS {
        identifier id PK
        identifier encounter_id FK
        identifier current_version_id FK
    }
    DIAGNOSIS_VERSION {
        identifier id PK
        identifier diagnosis_id FK
        identifier previous_version_id FK
        identifier author_role_id FK
        string code_system
        string code
        string display
        text free_text
        code status
    }
    PRESCRIPTION {
        identifier id PK
        identifier encounter_id FK
        identifier prescriber_role_id FK
        date prescribed_date
        code status
    }
    PRESCRIPTION_ITEM {
        identifier id PK
        identifier prescription_id FK
        identifier diagnosis_id FK
        string medication_code_system
        string medication_code
        string medication_display
        string strength
        string dose
        string route
        string frequency
        string quantity_or_duration
        text instruction
    }
    CLINICAL_ATTACHMENT {
        identifier id PK
        string storage_key UK
        string checksum
        string media_type
        integer size_bytes
        code scan_status
    }
    CLINICAL_ATTACHMENT_LINK {
        identifier id PK
        identifier attachment_id FK
        string owner_resource_type
        identifier owner_resource_id
        identifier owner_version_id
        identifier uploader_account_id FK
        identifier authorizer_role_id FK
    }
    ELECTRONIC_ATTESTATION {
        identifier id PK
        string target_resource_type
        identifier target_resource_id
        identifier target_version_id
        string target_digest
        code digest_algorithm
        code signer_actor_type
        code signer_capacity
        code method
        code validation_outcome
        instant attested_at
        string provider_reference
    }
```

`ElectronicAttestation` là quan hệ đa hình tới đúng target version/digest; Mermaid chỉ minh họa các target chính. Domain state `SIGNED` không tự chứng minh attestation hợp lệ. Category sức khỏe nền là design baseline `CLIN-03`; completeness pháp lý còn phụ thuộc mapping Chương X TT32.

### 16.2. EpisodeOfCare, CareTeam và Referral

```mermaid
erDiagram
    PATIENT {
        identifier id PK
    }
    ENCOUNTER {
        identifier id PK
        identifier visit_id FK
    }
    PRACTITIONER_ROLE {
        identifier id PK
    }
    EPISODE_OF_CARE {
        identifier id PK
        identifier patient_id FK
        text problem
        text goal
        code status
        integer version
    }
    ENCOUNTER_EPISODE {
        identifier id PK
        identifier encounter_id FK
        identifier episode_of_care_id FK
        code link_type
        identifier confirmer_account_id FK
        code suggestion_source
        instant changed_at
        text change_reason
    }
    CARE_TEAM {
        identifier id PK
        identifier episode_of_care_id FK, UK
        code status
    }
    CARE_TEAM_MEMBER {
        identifier id PK
        identifier care_team_id FK
        identifier practitioner_role_id FK
        code team_role
        instant effective_from
        instant effective_to
        code status
    }
    RESPONSIBLE_DOCTOR_ASSIGNMENT {
        identifier id PK
        identifier episode_of_care_id FK
        identifier practitioner_role_id FK
        instant effective_from
        instant effective_to
        code status
    }
    REFERRAL {
        identifier id PK
        identifier encounter_id FK
        identifier destination_department_id FK
        identifier destination_practitioner_role_id FK
        code priority
        code status
        text rejection_reason
        instant requested_at
        instant decided_at
    }
    REFERRAL_SLOT_REQUEST {
        identifier id PK
        identifier referral_id FK, UK
        identifier appointment_id FK, UK
        code status
    }

    PATIENT ||--o{ EPISODE_OF_CARE : "có"
    ENCOUNTER ||--o{ ENCOUNTER_EPISODE : "được phân loại"
    EPISODE_OF_CARE ||--o{ ENCOUNTER_EPISODE : "tập hợp"
    EPISODE_OF_CARE ||--|| CARE_TEAM : "có team riêng"
    CARE_TEAM ||--o{ CARE_TEAM_MEMBER : "gồm"
    PRACTITIONER_ROLE ||--o{ CARE_TEAM_MEMBER : "tham gia"
    EPISODE_OF_CARE ||--o{ RESPONSIBLE_DOCTOR_ASSIGNMENT : "có phụ trách"
    PRACTITIONER_ROLE ||--o{ RESPONSIBLE_DOCTOR_ASSIGNMENT : "được chỉ định"
    ENCOUNTER ||--o{ REFERRAL : "tạo"
    REFERRAL ||--o| REFERRAL_SLOT_REQUEST : "có thể cần ca"
```

EncounterEpisode tối đa một PRIMARY mỗi Encounter; Encounter/Visit/Episode cùng Patient. Mỗi Episode có một CareTeam và tối đa một responsible doctor hiệu lực. Merge/split mang `EPI-DEFER-01`, không có migration MVP. Referral SLA còn `OPEN-REF-01`.

### 16.3. Orders và Results

```mermaid
erDiagram
    ENCOUNTER {
        identifier id PK
    }
    PRACTITIONER_ROLE {
        identifier id PK
    }
    CLINICAL_ORDER {
        identifier id PK
        identifier encounter_id FK
        identifier requester_role_id FK
        identifier service_id FK
        identifier performing_department_id FK
        code order_type
        code priority
        text clinical_reason
        text clinical_question
        instant requested_at
        instant accepted_at
        code status
        integer version
    }
    CLINICAL_RESULT {
        identifier id PK
        identifier clinical_order_id FK
        identifier current_version_id FK
    }
    CLINICAL_RESULT_VERSION {
        identifier id PK
        identifier clinical_result_id FK
        identifier previous_version_id FK
        identifier author_role_id FK
        identifier finalizer_role_id FK
        code status
        json payload
        string payload_schema_version
        text narrative
        text amendment_reason
        instant signed_at
        instant published_at
    }
    PRESCRIPTION {
        identifier id PK
        identifier encounter_id FK
        identifier prescriber_role_id FK
        date prescribed_date
        code status
    }
    PRESCRIPTION_ITEM {
        identifier id PK
        identifier prescription_id FK
        identifier diagnosis_id FK
        string medication_code_system
        string medication_code
        string medication_display
        string strength
        string dose
        string route
        string frequency
        string quantity_or_duration
        text instruction
    }

    ENCOUNTER ||--o{ CLINICAL_ORDER : "tạo"
    PRACTITIONER_ROLE ||--o{ CLINICAL_ORDER : "requester"
    CLINICAL_ORDER ||--o{ CLINICAL_RESULT : "có"
    CLINICAL_RESULT ||--o{ CLINICAL_RESULT_VERSION : "giữ version"
    PRACTITIONER_ROLE ||--o{ CLINICAL_RESULT_VERSION : "author"
    PRACTITIONER_ROLE o|--o{ CLINICAL_RESULT_VERSION : "finalizer"
    ENCOUNTER ||--o{ PRESCRIPTION : "kê"
    PRESCRIPTION ||--|{ PRESCRIPTION_ITEM : "gồm"
```

PRELIMINARY bắt buộc author; signed FINAL/AMENDED/CORRECTED bắt buộc authorized finalizer và attestation hợp lệ khi signer matrix yêu cầu; publish là transition riêng. Amendment/correction tạo version và attestation mới. ClinicalOrder phải chỉ rõ service/test, reason/priority/time/nơi thực hiện; quan hệ ServiceDelivery được kiểm tra theo cùng Encounter/Patient. Critical workflow còn `OPEN-ORD-02`; catalog không nhận critical test trước gate.

### 16.4. Nội trú và giường bệnh

> [!NOTE]
> Contract `INP-DEFER-01` thuộc sau MVP. Không có migration Release 1/MVP ngoại trú; ERD giữ extension boundary.

```mermaid
erDiagram
    ENCOUNTER {
        identifier id PK
    }
    ADMISSION_REQUEST {
        identifier id PK
        identifier encounter_id FK
        identifier department_id FK
        text reason
        code priority
        code status
    }
    ADMISSION_WAITLIST_ENTRY {
        identifier id PK
        identifier admission_request_id FK, UK
        instant created_at
        code status
    }
    VISIT {
        identifier id PK
    }
    ADMISSION {
        identifier id PK
        identifier visit_id FK, UK
        code status
    }
    DISCHARGE {
        identifier id PK
        identifier admission_id FK, UK
        identifier signed_by_role_id FK
        instant signed_at
        instant departed_at
        text summary
        code status
    }
    BED {
        identifier id PK
        identifier room_id FK
        string code UK
        code status
    }
    BED_ASSIGNMENT {
        identifier id PK
        identifier admission_id FK
        identifier bed_id FK
        instant start_at
        instant end_at
        code status
    }

    ENCOUNTER ||--o{ ADMISSION_REQUEST : "đề xuất"
    ADMISSION_REQUEST ||--o| ADMISSION_WAITLIST_ENTRY : "có thể chờ"
    ADMISSION_REQUEST ||--o| VISIT : "tạo Visit nội trú"
    VISIT ||--o| ADMISSION : "có"
    ADMISSION ||--o| DISCHARGE : "kết thúc"
    ADMISSION ||--o{ BED_ASSIGNMENT : "lịch sử giường"
    BED ||--o{ BED_ASSIGNMENT : "được phân"
```

### 16.5. Billing và thanh toán

> [!IMPORTANT]
> Đây là ERD target R1, không phải runtime inventory. Hiện Flyway mới migrate `appointment` staging schema; `payment_intent`, `payment`, billing, allocation và refund chưa có migration. Physical contract tại [[schema/scheduling-payment-r1|Scheduling/payment R1]] và [[schema/billing-reliability-notification-r1|Billing/reliability R1]] là canonical.

```mermaid
erDiagram
    VISIT {
        identifier id PK
    }
    ENCOUNTER {
        identifier id PK
    }
    SERVICE {
        identifier id PK
    }
    SLOT_HOLD {
        identifier id PK
    }
    APPOINTMENT {
        identifier id PK
    }
    SERVICE_DELIVERY {
        identifier id PK
        identifier encounter_id FK
        identifier service_id FK
        identifier performed_by_role_id FK
        amount quantity
        instant performed_at
        code status
    }
    BILLING_ACCOUNT {
        identifier id PK
        identifier visit_id FK, UK
        code status
        amount balance_due
        code currency
        integer version
    }
    CHARGE_ITEM {
        identifier id PK
        identifier billing_account_id FK
        identifier service_delivery_id FK, UK
        identifier replaces_charge_item_id FK
        amount quantity
        amount unit_price
        amount discount_amount
        amount gross_amount
        amount net_amount
        code currency
        code status
    }
    PAYMENT_INTENT {
        identifier id PK
        identifier slot_hold_id FK, UK
        code status
    }
    PAYMENT {
        identifier id PK
        identifier payment_intent_id FK
        string provider
        string provider_transaction_id
        amount amount
        code currency
        code status
        instant captured_at
    }
    PAYMENT_ALLOCATION {
        identifier id PK
        identifier payment_id FK
        identifier billing_account_id FK
        amount amount
    }
    REFUND_REQUEST {
        identifier id PK
        identifier payment_id FK
        identifier proposer_account_id FK
        identifier approver_account_id FK
        amount amount
        text reason
        code status
    }
    REFUND {
        identifier id PK
        identifier refund_request_id FK, UK
        identifier payment_id FK
        amount amount
        code status
        instant completed_at
    }
    REFUND_ALLOCATION {
        identifier id PK
        identifier refund_id FK
        identifier billing_account_id FK
        identifier payment_allocation_id FK
        amount amount
    }
    CHARGE_REVERSAL_REQUEST {
        identifier id PK
        identifier charge_item_id FK
        identifier proposer_account_id FK
        identifier approver_account_id FK
        text reason
        code status
    }

    ENCOUNTER ||--o{ SERVICE_DELIVERY : "xác nhận"
    SERVICE ||--o{ SERVICE_DELIVERY : "được thực hiện"
    VISIT ||--|| BILLING_ACCOUNT : "có"
    SERVICE_DELIVERY ||--o| CHARGE_ITEM : "tạo phí"
    BILLING_ACCOUNT ||--o{ CHARGE_ITEM : "tổng hợp"
    SLOT_HOLD ||--o| PAYMENT_INTENT : "checkout"
    PAYMENT_INTENT ||--o| PAYMENT : "capture"
    PAYMENT ||--o{ PAYMENT_ALLOCATION : "phân bổ"
    BILLING_ACCOUNT ||--o{ PAYMENT_ALLOCATION : "nhận"
    PAYMENT ||--o{ REFUND_REQUEST : "đề xuất hoàn"
    REFUND_REQUEST ||--o| REFUND : "thực thi"
    REFUND ||--o{ REFUND_ALLOCATION : "phân bổ hoàn"
    BILLING_ACCOUNT ||--o{ REFUND_ALLOCATION : "bị giảm paid total"
    CHARGE_ITEM ||--o{ CHARGE_REVERSAL_REQUEST : "đề xuất đảo"
```

Capture và Refund là movement bất biến; ledger không dựa current Payment status. ServiceDelivery là charge source duy nhất. BillingAccount close/reopen theo `BILL-08/BILL-09`.

### 16.6. Hồ sơ phụ thuộc và xác minh

> [!IMPORTANT]
> Diagram trộn runtime identity/patient tables với target R1 và MVP-LATER. `patient`, `patient_account_link`, `patient_identifier`, `patient_duplicate_candidate`, `account_role_assignment`, `break_glass_grant` và `audit_event` đã migrate. `dependent_verification`/`verification_evidence` là MVP-LATER; `electronic_identity_link` là REGULATORY-PRODUCTION. Xem [[21-schema-vat-ly-mvp|Schema vật lý MVP]] trước khi sinh DDL.

```mermaid
erDiagram
    USER_ACCOUNT {
        identifier id PK
        string login_identifier UK
        code auth_method
        code status
        integer version
    }
    PATIENT {
        identifier id PK
        string full_name
        date date_of_birth
        string phone
        string email
        code declared_gender
        text address
        json emergency_contact
        integer version
    }
    PATIENT_ACCOUNT_LINK {
        identifier id PK
        identifier user_account_id FK
        identifier patient_id FK
        code relationship
        code verification_tier
        json permission_scope
        instant valid_from
        instant valid_to
        code status
        instant revoked_at
    }
    DEPENDENT_VERIFICATION {
        identifier id PK
        identifier patient_account_link_id FK
        code verification_type
        identifier reviewer_account_id FK
        code status
        instant reviewed_at
        instant expires_at
    }
    VERIFICATION_EVIDENCE {
        identifier id PK
        identifier verification_id FK
        string storage_key UK
        string checksum
        string media_type
        integer size_bytes
        identifier uploaded_by_account_id FK
        instant created_at
        instant expires_at
        code scan_status
    }
    ROLE {
        identifier id PK
        string code UK
        string name
    }
    PERMISSION {
        identifier id PK
        string action UK
    }
    ACCOUNT_ROLE_ASSIGNMENT {
        identifier id PK
        identifier user_account_id FK
        identifier role_id FK
        identifier department_id FK
        instant effective_from
        instant effective_to
    }
    BREAK_GLASS_GRANT {
        identifier id PK
        identifier user_account_id FK
        identifier patient_id FK
        text purpose
        text reason
        instant effective_from
        instant expires_at
        code review_status
    }
    AUDIT_EVENT {
        identifier id PK
        identifier actor_account_id FK
        identifier patient_id FK
        code actor_type
        string resource_type
        identifier resource_id
        string action
        code outcome
        text reason
        string correlation_id
        json before_value
        json after_value
        instant occurred_at
    }

    USER_ACCOUNT ||--o{ PATIENT_ACCOUNT_LINK : "quản lý"
    PATIENT ||--o{ PATIENT_ACCOUNT_LINK : "được liên kết"
    PATIENT_ACCOUNT_LINK ||--o{ DEPENDENT_VERIFICATION : "xác minh"
    DEPENDENT_VERIFICATION ||--o{ VERIFICATION_EVIDENCE : "evidence"
    USER_ACCOUNT ||--o{ ACCOUNT_ROLE_ASSIGNMENT : "được gán"
    ROLE ||--o{ ACCOUNT_ROLE_ASSIGNMENT : "bundle"
    ROLE ||--o{ PERMISSION : "cấp action"
    USER_ACCOUNT ||--o{ BREAK_GLASS_GRANT : "yêu cầu"
    PATIENT ||--o{ BREAK_GLASS_GRANT : "phạm vi"
    USER_ACCOUNT o|--o{ AUDIT_EVENT : "actor"
```

Patient phone nullable; contact canonical qua account/link. Tier 0/1/2 và evidence storage theo `DEP-06`–`DEP-11`. Permission scope deny-by-default; audit append-only.

#### 16.6.1. Định danh cá nhân, electronic identity và audit evidence

```mermaid
erDiagram
    PATIENT ||--o{ PATIENT_IDENTIFIER : "có identifier"
    PATIENT ||--o{ ELECTRONIC_IDENTITY_LINK : "liên kết định danh"
    USER_ACCOUNT o|--o{ ELECTRONIC_IDENTITY_LINK : "có thể sở hữu link"
    USER_ACCOUNT ||--o{ BREAK_GLASS_GRANT : "requester"
    USER_ACCOUNT o|--o{ BREAK_GLASS_GRANT : "grantor/reviewer"
    PATIENT ||--o{ BREAK_GLASS_GRANT : "phạm vi"

    PATIENT_IDENTIFIER {
        identifier id PK
        identifier patient_id FK
        code identifier_type
        string issuer
        string jurisdiction
        string protected_value
        code status
        code verification_source
        instant verified_at
        instant effective_from
        instant effective_to
        instant revoked_at
    }
    ELECTRONIC_IDENTITY_LINK {
        identifier id PK
        identifier patient_id FK
        identifier user_account_id FK
        string external_system
        string external_subject_reference
        code assurance_level
        code status
        instant linked_at
        instant verified_at
        instant revoked_at
    }
```

`BREAK_GLASS_GRANT` physical contract bổ sung requester, grantor/policy mechanism, reviewer, alert/ticket và review timestamps/outcome. `AUDIT_EVENT` bổ sung effective-role snapshot, purpose of use, authorization basis, source/session/request/correlation, export/download và review metadata. Raw biometric/private key/secret không thuộc các payload này.

### 16.7. Độ bao phủ và traceability

| Chủ đề | Contract canonical |
|---|---|
| Actor/catalog/RBAC | 16.1, 16.6/16.6.1; `IAM-01`, `CAT-01`, `SEC-03`–`SEC-05` |
| Hồ sơ lâm sàng/attestation | 16.1.1; `CLIN-01`–`CLIN-03`, `SIGN-01`, ADR-0007/0008 |
| Định danh cá nhân/electronic identity | 16.6.1; `IDN-01`, ADR-0008 |
| Scheduling/check-in/queue | 16.1; `APT-06`, `CHECKIN-01`, `QUEUE-06/07`, `VISIT-01/02` |
| Episode/Referral | 16.2; `OPEN-REF-01`, `EPI-DEFER-01` |
| Orders/Results | 16.3; `ORD-05`–`ORD-07`, `OPEN-ORD-02` |
| Inpatient | 16.4; `INP-DEFER-01` |
| Billing/payment | 16.5; `PAY-02`–`PAY-05`, `BILL-06`–`BILL-09`, `OPEN-PAY-01` |
| Dependent/privacy | 16.6; `DEP-06`–`DEP-11` |
| Kiểu/constraint/index | [[21-schema-vat-ly-mvp|Schema vật lý]], [[adr/README|ADR]] |

OPEN hợp lệ không chặn Release 1: `OPEN-PAY-01`, `OPEN-REF-01`, `OPEN-ORD-02`. Deferred: `EPI-DEFER-01`, `INP-DEFER-01`.

### 16.8. Quy tắc toàn vẹn

1. SlotHold expired không tạo Appointment; consumed tạo đúng một Appointment.
2. Reservation active không vượt capacity; check-in không giải phóng reservation.
3. Mỗi Doctor role tối đa 4 ca/ngày, 2 mỗi session.
4. Appointment có thể không có Visit; walk-in Visit có thể không có Appointment.
5. CheckIn idempotent tạo/lấy đúng một Visit cho Appointment.
6. Encounter suy ra Patient qua Visit; EncounterEpisode chỉ liên kết Episode cùng Patient.
7. Mỗi Episode có một CareTeam; tối đa một responsible doctor hiệu lực.
8. Mỗi Encounter tối đa một Episode PRIMARY.
9. QueueEntry tối đa một active mỗi Encounter; adjustment không sửa checked_in_at.
10. ClinicalNote/Diagnosis R1 `FINALIZED` và lawful-signed Result/content không ghi đè; amendment/correction tạo version mới, lawful tranche tạo attestation mới khi mapping yêu cầu.
11. `FINALIZED` chỉ là hoàn tất kỹ thuật. Domain state `SIGNED` không tự chứng minh giá trị pháp lý; attestation nhắm đúng immutable version/digest và sign tách publish.
12. Result phải thuộc Order hợp lệ; latest published version duy nhất.
13. Mỗi Visit đúng một BillingAccount.
14. Một ServiceDelivery tối đa một original ChargeItem.
15. Allocation/refund không vượt captured/refundable amount.
16. Proposer không tự approve financial adjustment.
17. Dependent clinical access cần Tier 2 + permission scope hợp lệ; signer capacity kiểm riêng.
18. Patient identifier/electronic identity mismatch hoặc revoke không auto-merge/relink.
19. Attachment nhắm đúng owner resource/version và checksum; binary không nằm trong DB.
20. Money dùng decimal; instant UTC; optimistic/version guard bắt buộc.
21. Audit/inbox/outbox/idempotency giữ correlation và không tạo side effect trùng.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[20-so-quyet-dinh-kien-truc|Kiến trúc]]
- [[21-schema-vat-ly-mvp|Schema vật lý]]
- [[22-backlog-mvp|Backlog]]
- [[adr/README|ADR index]]
<!-- related-links:end -->
