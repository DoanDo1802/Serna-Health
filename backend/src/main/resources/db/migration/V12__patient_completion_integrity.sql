-- R1-04 Patient workflow completion. Forward-only; V4/V8/V9 remain immutable.

alter table patient_identifier
    add constraint ck_patient_identifier_verification_source
    check (verification_source in ('SELF_DECLARED', 'STAFF_RECORDED'));

alter table patient_account_link
    add constraint ck_patient_account_link_relationship
    check (relationship in ('OWN', 'SELF', 'PARENT', 'CHILD', 'SPOUSE', 'GUARDIAN', 'REPRESENTATIVE')),
    add constraint ck_patient_account_link_scope
    check (
        jsonb_typeof(permission_scope) = 'object'
        and permission_scope ? 'version'
        and permission_scope ->> 'version' = '1'
        and permission_scope - 'version' - 'patient.read' = '{}'::jsonb
        and (not (permission_scope ? 'patient.read') or jsonb_typeof(permission_scope -> 'patient.read') = 'boolean')
    ),
    add constraint ck_patient_account_link_revocation
    check (
        (status = 'REVOKED' and revoked_at is not null and revoke_reason is not null and btrim(revoke_reason) <> '')
        or (status <> 'REVOKED' and revoked_at is null and revoke_reason is null)
    );

create index ix_duplicate_candidate_source_pending
    on patient_duplicate_candidate (source_patient_id, created_at, id) where status = 'PENDING';
create index ix_duplicate_candidate_candidate_pending
    on patient_duplicate_candidate (candidate_patient_id, created_at, id) where status = 'PENDING';
create index ix_patient_identifier_patient_effective
    on patient_identifier (patient_id, effective_from desc, id desc);
create index ix_patient_account_link_patient_valid
    on patient_account_link (patient_id, valid_from desc, id desc);
