-- Error transitions retain audit evidence separately; candidate reviewer columns remain reserved for CONFIRMED/REJECTED.
alter table patient_duplicate_candidate drop constraint ck_duplicate_candidate_review;
alter table patient_duplicate_candidate add constraint ck_duplicate_candidate_review check (
    (status in ('CONFIRMED', 'REJECTED') and reviewer_account_id is not null and reviewed_at is not null and review_reason is not null)
    or (status in ('PENDING', 'ENTERED_IN_ERROR') and reviewer_account_id is null and reviewed_at is null and review_reason is null)
);
