-- R1-05 scoped delegation for SlotHold patient representatives. V12 remains immutable.

alter table patient_account_link drop constraint ck_patient_account_link_scope;
alter table patient_account_link
    add constraint ck_patient_account_link_scope
    check (
        jsonb_typeof(permission_scope) = 'object'
        and permission_scope ? 'version'
        and permission_scope ->> 'version' = '1'
        and permission_scope - 'version' - 'patient.read' - 'slot_hold.create' - 'slot_hold.read' - 'slot_hold.cancel' = '{}'::jsonb
        and (not (permission_scope ? 'patient.read') or jsonb_typeof(permission_scope -> 'patient.read') = 'boolean')
        and (not (permission_scope ? 'slot_hold.create') or jsonb_typeof(permission_scope -> 'slot_hold.create') = 'boolean')
        and (not (permission_scope ? 'slot_hold.read') or jsonb_typeof(permission_scope -> 'slot_hold.read') = 'boolean')
        and (not (permission_scope ? 'slot_hold.cancel') or jsonb_typeof(permission_scope -> 'slot_hold.cancel') = 'boolean')
    );
