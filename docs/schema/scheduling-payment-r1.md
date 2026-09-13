---
aliases:
  - Scheduling payment schema R1
artifact_type: r1-schema-contract
status: ACCEPTED
module_owners:
  - scheduling
  - billing-payment
  - platform-audit
---
# Scheduling và payment deposit — R1

## Mô hình lịch khám

`appointment_slot` vẫn là đơn vị capacity và assignment thực. Mỗi slot gắn một `practitioner_role`, khoa, phòng, dịch vụ, khung giờ và sức chứa. `slot_hold` cùng `appointment` luôn giữ `slot_id` chính xác đã chọn. Hệ thống không tái phân bác sĩ/phòng sau khi tạo hold hoặc appointment.

Bệnh nhân đặt lịch thường chọn khoa, dịch vụ, ngày địa phương và buổi khám; không chọn bác sĩ. API availability chỉ trả aggregate theo `booking_session`, không trả `slot_id`, `practitioner_role_id`, bác sĩ hoặc phòng. Sau khi giữ chỗ thành công, response mới trả tên bác sĩ, phòng và giờ đã phân công.

Đặt lại lịch vẫn là exact-slot flow: bệnh nhân chọn target `slot_id`, tạo reschedule hold và giữ nguyên payment/deposit transfer cùng immutable appointment lineage.

## `booking_session`

**Owner / purpose:** `scheduling` / bucket bệnh nhân có thể chọn.

| Column | PostgreSQL type | Contract |
|---|---|---|
| `id` | `uuid` | UUIDv7 PK |
| `department_id`, `service_id` | `uuid` | FK RESTRICT; tiêu chí bệnh nhân chọn |
| `local_date` | `date` | ngày tại `Asia/Ho_Chi_Minh` |
| `session` | `varchar(64)` | `MORNING` hoặc `AFTERNOON` |
| `start_at`, `end_at` | `timestamptz` | khung giờ chuẩn; `end_at > start_at` |
| `status` | `varchar(64)` | `ACTIVE` hoặc `CANCELLED` |
| `version`, timestamps | `bigint`, `timestamptz` | optimistic concurrency và audit |

Chỉ có một bucket `ACTIVE` cho `(department_id, service_id, local_date, session)`. Tạo schedule cùng bucket dùng transaction advisory lock trước lookup/insert để không tạo hai bucket cạnh tranh.

Khung giờ chuẩn tại `Asia/Ho_Chi_Minh`:

| Session | Local time |
|---|---|
| `MORNING` | 08:00–12:00 |
| `AFTERNOON` | 13:30–17:30 |

Không lưu `FULL_DAY` hoặc `OFF`. UI “cả ngày” gửi hai create command độc lập; không có lịch nghĩa là bác sĩ nghỉ.

## `work_schedule`

**Owner / purpose:** `scheduling` / lịch trực thực của một bác sĩ và một phòng dưới `booking_session`.

Columns: `id uuid`, `booking_session_id uuid`, `practitioner_role_id uuid`, `room_id uuid`, `capacity integer`, `status varchar(64)`, `version bigint`, timestamps. PK/FKs RESTRICT; capacity > 0; status `ACTIVE/CANCELLED`.

Mỗi work schedule materialize đúng một doctor-bound `appointment_slot`. `appointment_slot.work_schedule_id` là nullable FK RESTRICT với partial unique index, bảo đảm quan hệ 1:1 khi đã liên kết. Slot giữ các rule overlap/quota hiện có cho practitioner và room.

Admin chỉ sửa capacity. Command khóa schedule và slot liên kết, từ chối capacity thấp hơn active holds cộng `CONFIRMED`/`FULFILLED` appointments. Cancel dùng `If-Match`, từ chối nếu schedule đã có giữ chỗ hoặc lịch hẹn, rồi cancel schedule và exact slot; không reassign bệnh nhân.

## Normal booking và auto-assignment

`GET /booking/availability` nhận `patientId`, và có thể lọc `departmentId`, `serviceId`, `date`, `session`. Response aggregate gồm capacity tổng, đã giữ, còn lại và holdability. API không lộ slot/bác sĩ/phòng.

`POST /slot-holds` nhận:

```json
{
  "bookingSessionId": "uuid",
  "patientId": "uuid"
}
```

Trong một transaction, hệ thống:

1. Kiểm tra patient access và khóa schedule của bệnh nhân.
2. Khóa booking session active, tìm candidate work schedule/slot active trong bucket.
3. Khóa work schedule và exact slot theo `slot.id` tăng dần, expire stale holds.
4. Kiểm tra conflict của bệnh nhân trước khi trả lỗi hết chỗ.
5. Đếm active nonexpired hold cộng appointment `CONFIRMED`/`FULFILLED` trên từng exact slot.
6. Chọn slot theo thứ tự xác định: utilization thấp nhất, used capacity thấp nhất, giờ bắt đầu sớm nhất, practitioner role ID, slot ID.
7. Tạo `slot_hold` trên exact slot đã chọn và trả assignment hiển thị an toàn.

Row lock này bảo vệ capacity; concurrent normal holds không được oversell. Assignment đã trả về là cố định, không rebalance sau đó.

## `appointment_slot`

**Owner / tranche / purpose:** `scheduling` / R1 / capacity exact theo PractitionerRole/Department/Room/Service.

Columns: `id uuid`, practitioner role/department/room/service UUIDs, optional `work_schedule_id uuid`, `session varchar(64)`, `start_at/end_at timestamptz`, `capacity integer`, `status varchar(64)`, `version bigint`, timestamps. PK/FKs RESTRICT; capacity > 0; end > start; session `MORNING/AFTERNOON`; status `ACTIVE/CANCELLED/REPLACED`; cùng role không overlap active qua exclusion constraint trên `[start,end)`; room overlap bị cấm tương tự; tối đa 4/day/2 session dùng transaction locking practitioner/day và service date `Asia/Ho_Chi_Minh`. Index service/start/status, role/start, department/start.

Raw appointment-slot reads yêu cầu `appointment_slot.read`; patient normal booking không dựa vào route này.

## `slot_hold`

Columns: `id uuid`, slot/patient UUIDs, `expires_at timestamptz`, `deposit_amount numeric(19,2)`, `currency char(3)`, `status varchar(64)`, `version bigint`, timestamps. PK/FKs; currency VND; amount >= 0; expires > created; status enum. Partial index active expiry; slot/status index. Capacity đếm ACTIVE, nonexpired holds cộng `CONFIRMED`/`FULFILLED` appointments dưới slot row lock.

HTTP/API retry dùng `platform-audit.idempotency_record` làm source of truth. Legacy `slot_hold.idempotency_scope`, `slot_hold.idempotency_key`, và `slot_hold.request_hash` là residue nullable từ `V5`, không dùng sau `V13`; chỉ bỏ bằng forward migration đã kiểm tra compatibility.

## `payment_intent`

Columns: `id uuid`, `slot_hold_id uuid`, `provider varchar(64)`, `provider_reference varchar(128) null`, `amount numeric(19,2)`, `currency char(3)`, `status varchar(64)`, `reconciliation_reason varchar(256) null`, `version bigint`, timestamps. PK/FK; unique slot_hold; partial unique provider/reference non-null; amount >= 0/currency VND; status check; reconciliation reason required for `RECONCILIATION_REQUIRED`. Index status/updated, provider/reference.

## `appointment`

Target contract columns: `id uuid`, patient/slot_hold UUIDs, `rescheduled_from_id/rescheduled_to_id uuid null`, `status varchar(64)`, `version bigint`, `created_at/updated_at timestamptz`. PK/FKs RESTRICT gồm self-FK; unique slot_hold; partial unique from/to non-null; no self lineage; reciprocal lineage và cùng patient được enforce trong command transaction; status check. Index patient/status/time, slot/status. Reservation-consuming states là `CONFIRMED/FULFILLED`.

`V13__scheduling_r1_05_completion.sql` hiện cung cấp staging schema patient, optional slot hold, slot, status, version, timestamps. Nó dùng cho capacity count nhưng chưa có booking/confirmation/reschedule command path đầy đủ; chỉ thêm target lineage/uniqueness constraints qua forward migration cùng R1-06/R1-07 implementation.

## `webhook_inbox`

**Owner / purpose:** `platform-audit` / immutable provider event evidence và processing state.

Columns: `id uuid`, `provider varchar(64)`, `event_id varchar(128)`, `event_type varchar(128)`, `provider_transaction_id varchar(128) null`, `signature_status varchar(64)`, `payload_hash varchar(128)`, `payload jsonb`, `provider_occurred_at timestamptz null`, `received_at timestamptz`, `provider_time_trust varchar(64)`, `amount numeric(19,2) null`, `currency char(3) null`, `status varchar(64)`, `processed_at timestamptz null`, `error_code varchar(128) null`, `attempts integer`, `next_attempt_at timestamptz null`, `correlation_id varchar(128)`, `version bigint`.

Constraints: unique `(provider,event_id)`; signature/time/status checks; trusted requires VALID + non-null occurred time + within ±5m of received; amount/currency pair; processed timestamp terminal; attempts >= 0. Index status/next attempt, provider transaction, received time, correlation.

## `payment`, allocation và transfer

`payment` là immutable capture movement: provider/transaction ID, amount/currency, status, provider occurred time/trust, webhook inbox, captured time. Unique `(provider,transaction_id)`; amount > 0; VND; captured status requires captured timestamp. Không update amount/transaction/occurred time sau insert.

`deposit_allocation` là allocation immutable từ payment sang appointment. Active sum của appointment phải bằng required deposit trong locked transaction. `deposit_transfer` ghi transfer khi reschedule: old/new appointment, source/target allocation, amount/currency, difference, disposition, actor/reason/correlation/timestamp. Mỗi old appointment có tối đa một replacement; external refund thực hiện sau commit qua outbox/reconciliation.

## HTTP invariants

- Create/cancel work schedule và create normal hold bắt buộc session cookie, CSRF token, `Idempotency-Key`.
- Update/cancel work schedule dùng `If-Match`; server trả ETag mới, `412` khi stale, `428` khi thiếu precondition.
- Normal hold giữ idempotency payload theo `bookingSessionId`/`patientId`; retry cùng key/payload trả cùng exact assignment.
- `409` biểu thị conflict domain, idempotency hoặc hết capacity sau serialization.
- Payment creation, hold lifecycle và exact reschedule giữ contract hiện có.

## Trace

| Story | Decisions | ADR | Scenarios |
|---|---|---|---|
| `R1-05` | `APT-01..03`, `DATA-05` | ADR-0003/0006 | `SC-R1-BOOK-04` |
| `R1-06` | `PAY-02..06` | ADR-0006/0011 | `SC-R1-PAY-01..02`, `SC-R1-BOOK-01..03` |
| `R1-07` | `APT-04`, `APT-06`, `PAY-07` | ADR-0005/0011 | `SC-R1-RESCHEDULE-01..02` |

Related: [[../05-thanh-toan-va-doanh-thu|Payment]], [[../22-backlog-mvp|Backlog]], [[README|Schema conventions]].
