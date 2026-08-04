---
aliases:
  - ADR-0010 Authentication, session và account security
artifact_type: adr
status: ACCEPTED
date: 2026-08-04
decision_ids:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06
---
# ADR-0010 — Authentication, session và account security

## Context

Release 1 cần đăng ký/đăng nhập nhưng contract cũ chỉ nêu OTP hoặc email/password. Thiếu credential lifecycle, session, recovery, lockout, anti-enumeration và giá trị testable.

## Decision

- Release 1 hỗ trợ email/password và one-time code gửi tới email đã xác minh. Phone/SMS, social login và remember-me nằm ngoài Release 1.
- Email được trim, lowercase theo Locale.ROOT và unique bằng `normalized_email`; response đăng ký, OTP và recovery không tiết lộ account có tồn tại.
- Password dài 12–128 ký tự, hash Argon2id bằng Spring Security. Encoded hash tự chứa algorithm/parameters; application policy chặn common/breached password. Không ép rotation định kỳ.
- OTP sinh bằng CSPRNG, chỉ lưu hash, purpose-scoped, TTL 10 phút, tối đa 5 lần nhập, resend sau 60 giây và tối đa 5 lần phát mỗi giờ theo target + source IP đã chuẩn hóa. Mã mới vô hiệu mã cũ cùng account/target/purpose.
- Session là opaque random ID phía server, truyền bằng cookie `Secure`, `HttpOnly`, `SameSite=Lax`. Unsafe browser request phải có CSRF token. Idle timeout 30 phút, absolute timeout 12 giờ; rotate ID sau authentication.
- Sau 5 password failure liên tiếp, account bị khóa tạm 15 phút. Login thành công reset counter. Account disabled/permanent locked không được authenticate.
- Email verification token và password reset token là one-time, purpose-scoped, chỉ lưu hash và có `expires_at`, `consumed_at`, `revoked_at`. Password reset TTL 30 phút.
- Password reset, email change, account disable/lock và nghi compromise revoke mọi active session/token. Không log password, OTP, session ID, reset token hoặc credential hash.
- Authentication chỉ xác nhận principal. Authorization vẫn default deny và đánh giá permission, scope, role, relation, state và effective time ở mỗi request.

## State contracts

- UserAccount: `PENDING_VERIFICATION`, `ACTIVE`, `TEMPORARILY_LOCKED`, `DISABLED`, `PERMANENTLY_LOCKED`.
- Credential: `ACTIVE`, `REVOKED`, `SUPERSEDED`.
- Challenge/token: `PENDING`, `CONSUMED`, `EXPIRED`, `REVOKED`, `LOCKED`.
- Session: `ACTIVE`, `EXPIRED`, `REVOKED`.

Expiry được suy từ timestamp canonical; worker có thể materialize status nhưng không được làm sống lại token/session.

## Alternatives rejected

- JWT stateless trong browser: khó revoke ngay khi password reset/account disable và tăng exposure token.
- OTP plaintext hoặc reusable token: tăng tác động khi DB/log lộ.
- SMS trong Release 1: thêm provider, cost, SIM-swap và delivery contract chưa cần cho thin slice.
- Role-based login endpoint riêng: trộn authentication với authorization.

## Consequences

- `identity-access` sở hữu UserAccount, credential, challenge/token và session.
- Rate-limit cần atomic DB update/lock trong Release 1; chưa bắt buộc Redis.
- Cookie session bắt buộc TLS ngoài local; API client không dùng cookie phải có contract riêng ở release sau.
- Security test phải bao phủ enumeration, timing-safe token compare, expiry boundary, replay, rate limit, lockout, CSRF, session fixation và revocation.

## Links

- [[0004-actor-rbac-audit-va-dependent-privacy|ADR-0004 — Actor, RBAC, audit và dependent privacy]]
- [[../07-phan-quyen|Phân quyền]]
- [[../12-yeu-cau-phi-chuc-nang|Yêu cầu phi chức năng]]
- [[../schema/identity-access-audit-r1|Schema identity/access/audit R1]]
- [[../22-backlog-mvp|Backlog và acceptance AUTH]]
