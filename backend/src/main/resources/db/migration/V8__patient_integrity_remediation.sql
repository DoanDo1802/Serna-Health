-- R1-04 ownership and reviewer integrity.
alter table patient_identifier add constraint fk_patient_identifier_collector
    foreign key (collected_by_account_id) references user_account(id) on delete restrict;
alter table patient_account_link add constraint fk_patient_account_link_account
    foreign key (account_id) references user_account(id) on delete restrict;
alter table patient_duplicate_candidate add constraint fk_patient_duplicate_candidate_reviewer
    foreign key (reviewer_account_id) references user_account(id) on delete restrict;
