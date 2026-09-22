-- R1-03 completion: a revoked practitioner role must retain immutable revocation evidence.
alter table practitioner_role
    add constraint ck_practitioner_role_revoke_state check (
        (status <> 'REVOKED' and revoked_at is null and revoked_by_account_id is null and revoke_reason is null)
        or (status = 'REVOKED' and revoked_at is not null and revoked_by_account_id is not null
            and revoke_reason is not null and btrim(revoke_reason) <> '')
    );
