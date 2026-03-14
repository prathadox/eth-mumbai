-- Latest changes: indexes for dashboard table + verify-ens lookups

create index if not exists idx_employees_company_id on employees(company_id);
create index if not exists idx_employees_ens_name on employees(ens_name);
create index if not exists idx_contracts_employee_id on contracts(employee_id);
