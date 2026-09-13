alter table account_session add column tab_context_hash varchar(128);

update account_session
set tab_context_hash = 'legacy-session-without-tab-context'
where tab_context_hash is null;

alter table account_session alter column tab_context_hash set not null;

create index ix_account_session_tab_context_hash on account_session(tab_context_hash);
