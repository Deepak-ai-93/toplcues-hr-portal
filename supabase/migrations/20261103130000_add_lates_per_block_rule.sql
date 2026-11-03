-- Make the late-deduction block size configurable.
alter table public.payroll_rule_versions
  add column if not exists lates_per_deduction_block numeric(8, 2) not null default 2;

-- Apply the approved CL + Monsoon allowance when still at the old default.
update public.payroll_rule_versions
set cl_allowed_per_month = 7,
    updated_at = now()
where id = 'rules-v1.0'
  and cl_allowed_per_month = 2;

notify pgrst, 'reload schema';
