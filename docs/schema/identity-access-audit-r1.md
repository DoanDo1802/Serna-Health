---
aliases:
  - Identity access audit schema R1
artifact_type: r1-schema-contract
status: ACCEPTED
module_owners:
  - identity-access
  - platform-audit
---
# Identity, access và audit — R1

## `user_account`

**Owner / tranche / purpose:** `identity-access` / R1 / principal và lifecycle authentication.

| Column | PostgreSQL type | Null/default | Contract |
|---|---|---|---|
| `id` | `uuid` | not null | UUIDv7 PK |
| `normalized_email` | `varchar(320)` | not null | trim + lowercase Locale.ROOT; sensitive |
| `display_email` | `varchar(320)` | not null | email hiển thị; không dùng unique comparison |
| `email_verified_at` | `timestamptz` | null | null khi chưa xác minh |
| `status` | `varchar(64)` | not null | UserAccount enum |
| `failed_login_count` | `integer` | not null default 0 | `0..5`; reset khi login thành công |
| `locked_until` | `timestamptz` | null | required khi TEMPORARILY_LOCKED |
| `last_authenticated_at` | `timestamptz` | null | UTC |
| `version` | `bigint` | not null default 0 | optimistic lock |
| `created_at` | `timestamptz` | not null | immutable |
| `updated_at` | `timestamptz` | not null | mutable timestamp |

**Keys and constraints:** `pk_user_account`; `uk_user_account_normalized_email`; `ck_user_account_status`; `ck_user_account_failed_login_count` (`0 <= count and count <= 5`); `ck_user_account_lock_state` yêu cầu `locked_until` cho temporary lock và null cho active/pending.

**Indexes:** `ix_user_account_status_locked_until` phục vụ unlock/auth check.

**States and transitions:** PENDING_VERIFICATION → ACTIVE; ACTIVE ↔ TEMPORARILY_LOCKED; mọi nonterminal → DISABLED/PERMANENTLY_LOCKED bởi authorized command; unlock không hồi sinh session/token đã revoke.

## `password_credential`

**Owner / tranche / purpose:** `identity-access` / R1 / password credential versioned, không chứa plaintext.

| Column | PostgreSQL type | Null/default | Contract |
|---|---|---|---|
| `id` | `uuid` | not null | UUIDv7 PK |
| `account_id` | `uuid` | not null | FK UserAccount |
| `encoded_hash` | `varchar(512)` | not null | Spring Security Argon2id encoded string; secret |
| `status` | `varchar(64)` | not null | ACTIVE/REVOKED/SUPERSEDED |
| `created_at` | `timestamptz` | not null | credential issue time |
| `revoked_at` | `timestamptz` | null | required khi revoked/superseded |
| `revoke_reason` | `varchar(256)` | null | required khi revoked/superseded |

**Keys and constraints:** `pk_password_credential`; `fk_password_credential_account`; `ck_password_credential_status`; partial `uk_password_credential_active_account` unique `account_id where status='ACTIVE'`; revoke timestamp/reason state check.

**Indexes:** `ix_password_credential_account_created_at`.

**States and transitions:** ACTIVE → SUPERSEDED khi reset/change; ACTIVE → REVOKED khi compromise/disable. Không chuyển ngược.

## `authentication_challenge`

**Owner / tranche / purpose:** `identity-access` / R1 / email OTP cho login/verification.

| Column | PostgreSQL type | Null/default | Contract |
|---|---|---|---|
| `id` | `uuid` | not null | UUIDv7 PK |
| `account_id` | `uuid` | null | null cho generic registration/recovery flow trước resolve |
| `normalized_target` | `varchar(320)` | not null | email normalized; sensitive |
| `purpose` | `varchar(64)` | not null | `LOGIN`, `VERIFY_EMAIL` |
| `secret_hash` | `varchar(128)` | not null | keyed hash; secret |
| `status` | `varchar(64)` | not null default `PENDING` | challenge enum |
| `attempt_count` | `smallint` | not null default 0 | max 5 |
| `issued_at` | `timestamptz` | not null | UTC |
| `expires_at` | `timestamptz` | not null | exactly issued + 10m policy |
| `consumed_at` | `timestamptz` | null | one-time success |
| `revoked_at` | `timestamptz` | null | mã mới revoke mã cũ |
| `source_ip_hash` | `varchar(128)` | not null | keyed/redacted, rate-limit only |
| `request_id` | `varchar(128)` | not null | trace; không secret |

**Keys and constraints:** PK/FK; purpose/status checks; `ck_auth_challenge_attempt` (`0..5`); `ck_auth_challenge_expiry` (`expires_at > issued_at`); state timestamp checks; partial unique pending `(normalized_target,purpose) where status='PENDING'`.

**Indexes:** `ix_auth_challenge_target_purpose_issued`; `ix_auth_challenge_source_ip_issued`; `ix_auth_challenge_expires_pending`.

**States and transitions:** PENDING → CONSUMED/EXPIRED/REVOKED/LOCKED. Attempt thứ năm sai chuyển LOCKED atomically. Không chuyển ngược.

## `account_token`

**Owner / tranche / purpose:** `identity-access` / R1 / email verification và password reset one-time token.

| Column | PostgreSQL type | Null/default | Contract |
|---|---|---|---|
| `id` | `uuid` | not null | UUIDv7 PK |
| `account_id` | `uuid` | not null | FK UserAccount |
| `purpose` | `varchar(64)` | not null | `VERIFY_EMAIL`, `RESET_PASSWORD` |
| `token_hash` | `varchar(128)` | not null | keyed hash; globally unique |
| `status` | `varchar(64)` | not null default `PENDING` | token enum |
| `issued_at` | `timestamptz` | not null | UTC |
| `expires_at` | `timestamptz` | not null | reset 30m; verification theo policy config |
| `consumed_at` | `timestamptz` | null | one-time |
| `revoked_at` | `timestamptz` | null | revoke all on sensitive account change |
| `request_id` | `varchar(128)` | not null | trace |

**Keys and constraints:** unique `token_hash`; purpose/status/expiry/state checks; partial unique pending `(account_id,purpose) where status='PENDING'`.

**Indexes:** `ix_account_token_account_purpose`; `ix_account_token_expires_pending`.

## `account_session`

**Owner / tranche / purpose:** `identity-access` / R1 / opaque server-side browser session.

| Column | PostgreSQL type | Null/default | Contract |
|---|---|---|---|
| `id` | `uuid` | not null | internal UUIDv7, không làm cookie value |
| `account_id` | `uuid` | not null | FK UserAccount |
| `session_token_hash` | `varchar(128)` | not null | keyed hash của random cookie ID |
| `csrf_token_hash` | `varchar(128)` | not null | keyed hash; unsafe requests |
| `status` | `varchar(64)` | not null default `ACTIVE` | session enum |
| `authenticated_at` | `timestamptz` | not null | rotate fixation boundary |
| `last_seen_at` | `timestamptz` | not null | write throttled; idle 30m |
| `absolute_expires_at` | `timestamptz` | not null | authenticated + 12h |
| `revoked_at` | `timestamptz` | null | required khi revoked |
| `revoke_reason` | `varchar(256)` | null | required khi revoked |
| `source_ip_hash` | `varchar(128)` | null | redacted security evidence |
| `user_agent_hash` | `varchar(128)` | null | redacted security evidence |
| `version` | `bigint` | not null default 0 | concurrent revoke/touch |

**Keys and constraints:** unique `session_token_hash`; status/expiry/revoke-state checks; absolute expiry > authenticated time.

**Indexes:** `ix_account_session_account_status`; `ix_account_session_active_expiry` partial on ACTIVE.

**States and transitions:** ACTIVE → EXPIRED when idle/absolute boundary reached; ACTIVE → REVOKED. DB status không thay expiry calculation.

## RBAC tables

### `role`

Columns: `id uuid not null`, `code varchar(64) not null`, `name varchar(200) not null`, `active boolean not null default true`, `created_at timestamptz not null`. PK; unique code; nonblank checks. Index active/code.

### `permission`

Columns: `id uuid not null`, `action varchar(128) not null`, `description varchar(500) not null`, `active boolean not null default true`, `created_at timestamptz not null`. PK; unique action; action format check `^[a-z][a-z0-9_.]*$`.

### `role_permission`

Columns: `role_id uuid not null`, `permission_id uuid not null`, `granted_at timestamptz not null`, `granted_by_account_id uuid null`. Composite PK; FK role/permission/grantor RESTRICT; index permission. `granted_by_account_id` chỉ null cho immutable bootstrap/system seed grant trong Flyway; mọi command do account thực hiện phải lưu actor ID khác null.

### `account_role_assignment`

Columns: `id uuid not null`, `account_id uuid not null`, `role_id uuid not null`, `department_id uuid null`, `effective_from timestamptz not null`, `effective_to timestamptz null`, `status varchar(64) not null`, `assigned_by_account_id uuid not null`, `reason varchar(500) not null`, `version bigint not null default 0`. PK/FKs RESTRICT; `effective_to > effective_from`; status `ACTIVE/REVOKED/EXPIRED`; no duplicate equivalent active interval enforced by exclusion/transaction. Index account/time/status, role/time, department/time.

`department_id` là physical FK `ON DELETE RESTRICT` từ `V3__catalog.sql`, sau khi owner table `department` tồn tại. Application vẫn kiểm context và default-deny khi department không resolve được.

## `break_glass_grant`

**Owner / tranche / purpose:** `identity-access` / R1 / patient-scoped emergency access.

Columns are typed: `id uuid`, requester/grantor/reviewer account UUIDs, requester effective-role snapshot `jsonb`, `patient_id uuid`, purpose/reason `varchar(500)`, requested/granted/effective/expires/review timestamps `timestamptz`, alert/ticket/request/session/correlation IDs `varchar(128)`, status/review outcome `varchar(64)`, review reason `varchar(500)`, version bigint. All core request fields not null; grantor/reviewer nullable until transition.

Constraints: expiry ≤ effective + 4h; review deadline stored `review_due_at` and equals granted + policy business-day calculation; state timestamp requirements; status `REQUESTED/ACTIVE/EXPIRED/REVOKED/REVIEWED`; no financial/admin scope column exists. Index patient/status/time, requester/time, review due/status.

`patient_id` là physical FK `ON DELETE RESTRICT` từ `V6__security_reliability_remediation.sql`, sau khi owner table `patient` tồn tại. Không tạo shell patient table trong module identity.

## `audit_event`

**Owner / tranche / purpose:** `platform-audit` / R1 / append-only authorization/business evidence.

Columns: `id uuid`, `actor_type varchar(64)`, `actor_account_id uuid null`, `effective_role_snapshot jsonb null`, `patient_id uuid null`, purpose/authorization basis `varchar(256)`, resource type `varchar(128)`, resource ID `uuid null`, resource version `bigint null`, resource digest `varchar(128) null`, action `varchar(128)`, outcome `varchar(64)`, reason `varchar(500) null`, source system/event `varchar(128)`, session/request/correlation IDs `varchar(128)`, before/after redacted `jsonb null`, export/download boolean flags default false, recipient/channel/reviewer/approval metadata typed nullable, network/device hashes `varchar(128) null`, `occurred_at timestamptz not null`.

Constraints: PK; actor account required only for human account actor; outcome enum `SUCCEEDED/DENIED/FAILED`; reason required for DENIED/FAILED; no UPDATE/DELETE application repository. Index patient/time, resource/version, actor/time, correlation, action/outcome/time, export/time.

## Trace

| Story | Decisions | ADR | Scenarios |
|---|---|---|---|
| `R1-02` | `AUTH-01..06`, `SEC-03..05`, `REL-01`, `IAM-01` | ADR-0003, ADR-0004, ADR-0010 | `SC-R1-AUTH-01..03`, `SC-R1-SEC-01`, `SC-R1-REL-01` |

Related: [[../22-backlog-mvp|Backlog]], [[../07-phan-quyen|Authorization]], [[README|Schema conventions]].
