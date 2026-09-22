-- Migration V33: Add exam_template jsonb column to department for specialty medical examination templates
alter table department
    add column if not exists exam_template jsonb default '{"fields": []}'::jsonb;
