-- Migration V32: Associate services with departments
alter table service
    add column if not exists department_id uuid references department(id) on delete set null;

create index if not exists ix_service_department_id on service(department_id);

-- Associate existing consultation services with departments based on known codes
update service
set department_id = (select id from department where code = 'TM' limit 1)
where code = 'SRV-KTM' and department_id is null;

update service
set department_id = (select id from department where code = 'NTQ' limit 1)
where code = 'SRV-KBTQ' and department_id is null;
