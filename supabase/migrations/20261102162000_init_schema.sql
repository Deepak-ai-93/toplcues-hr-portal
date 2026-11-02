-- ============================================================================
-- Topclues Solutions – Payroll Portal
-- Supabase schema + Row Level Security
--
-- HOW TO APPLY:
--   Supabase Dashboard -> SQL Editor -> New query -> paste this file -> Run.
--   Safe to re-run: tables use IF NOT EXISTS and policies are dropped first.
--
-- SECURITY MODEL
--   * Anonymous users: no table grants, everything denied.
--   * Management is identified by the verified JWT email:
--       ceo@topclues.in                              -> SUPER_ADMIN
--       unicorn@topclues.in, marketing@topclues.in   -> HR
--   * Staff self-service is resolved by matching staff.google_email to the
--     JWT email (see public.my_staff_id()). Client-supplied IDs are never
--     trusted for authorization.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.jwt_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.jwt_email() = 'ceo@topclues.in';
$$;

create or replace function public.is_hr()
returns boolean
language sql
stable
as $$
  select public.jwt_email() in ('unicorn@topclues.in', 'marketing@topclues.in');
$$;

create or replace function public.is_management()
returns boolean
language sql
stable
as $$
  select public.is_super_admin() or public.is_hr();
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  photo_url text,
  role text not null default 'STAFF' check (role in ('SUPER_ADMIN', 'HR', 'STAFF')),
  staff_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create table if not exists public.staff (
  id text primary key,
  employee_code text not null,
  full_name text not null,
  google_email text not null,
  personal_email text,
  mobile text,
  department text not null default '',
  designation text not null default '',
  reporting_manager text,
  date_of_joining date not null,
  employment_type text not null default 'Full-Time',
  work_location text not null default '',
  monthly_salary numeric(14, 2) not null default 0,
  salary_effective_date date not null,
  status text not null default 'Active' check (status in ('Active', 'Inactive', 'Left')),
  leaving_date date,
  leaving_reason text,
  notes text,
  profile_photo_url text,
  bank_name text,
  account_holder_name text,
  account_number_masked text,
  ifsc text,
  branch_name text,
  account_type text check (account_type in ('Savings', 'Current')),
  bank_verification_status text not null default 'Pending'
    check (bank_verification_status in ('Pending', 'Verified', 'Rejected')),
  verified_by text,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists staff_google_email_key on public.staff (lower(google_email));
create unique index if not exists staff_employee_code_key on public.staff (employee_code);

create table if not exists public.salary_history (
  id text primary key default gen_random_uuid()::text,
  staff_id text not null references public.staff (id) on delete cascade,
  monthly_salary numeric(14, 2) not null,
  effective_from date not null,
  effective_to date,
  changed_by text not null,
  changed_at timestamptz not null default now(),
  reason text
);

create table if not exists public.payroll_periods (
  id text primary key,
  month text not null,
  year integer not null,
  days_in_month integer not null,
  status text not null default 'Draft'
    check (status in ('Draft', 'Calculated', 'Finalized', 'Published', 'Closed')),
  rule_version_id text not null,
  terms_version_id text not null,
  total_employees integer not null default 0,
  total_base_salary numeric(14, 2) not null default 0,
  total_additions numeric(14, 2) not null default 0,
  total_deductions numeric(14, 2) not null default 0,
  total_net_payout numeric(14, 2) not null default 0,
  created_by text not null,
  created_at timestamptz not null default now(),
  finalized_by text,
  finalized_at timestamptz,
  published_by text,
  published_at timestamptz,
  reopened_by text,
  reopened_at timestamptz,
  reopen_reason text
);

create table if not exists public.payroll_records (
  period_id text not null references public.payroll_periods (id) on delete cascade,
  staff_id text not null,
  id text not null,
  employee_code text not null,
  full_name text not null,
  department text not null default '',
  designation text not null default '',
  date_of_joining date,
  bank_name text,
  account_number_masked text,
  ifsc text,
  monthly_salary numeric(14, 2) not null default 0,
  lwp_days numeric(8, 2) not null default 0,
  cl_days numeric(8, 2) not null default 0,
  el_count numeric(8, 2) not null default 0,
  late_count integer not null default 0,
  extra_break_hours numeric(8, 2) not null default 0,
  early_leave_hours numeric(8, 2) not null default 0,
  extra_payment numeric(14, 2) not null default 0,
  extra_hours numeric(8, 2) not null default 0,
  holiday_working_days numeric(8, 2) not null default 0,
  outdoor_working_days numeric(8, 2) not null default 0,
  holiday_working_hours numeric(8, 2) not null default 0,
  remarks text,
  payroll_days integer not null default 0,
  per_day_salary numeric(14, 4) not null default 0,
  lwp_deduction numeric(14, 2) not null default 0,
  allowed_el_within_cl numeric(8, 2) not null default 0,
  excess_cl_days numeric(8, 2) not null default 0,
  excess_cl_deduction numeric(14, 2) not null default 0,
  extra_el_count numeric(8, 2) not null default 0,
  extra_el_deduction numeric(14, 2) not null default 0,
  chargeable_late_days numeric(8, 2) not null default 0,
  late_deduction numeric(14, 2) not null default 0,
  extra_break_deduction numeric(14, 2) not null default 0,
  early_leave_deduction numeric(14, 2) not null default 0,
  extra_hours_payment numeric(14, 2) not null default 0,
  holiday_day_payment numeric(14, 2) not null default 0,
  outdoor_payment numeric(14, 2) not null default 0,
  holiday_hourly_payment numeric(14, 2) not null default 0,
  gross_additions numeric(14, 2) not null default 0,
  gross_earnings numeric(14, 2) not null default 0,
  total_deductions numeric(14, 2) not null default 0,
  net_salary numeric(14, 2) not null default 0,
  slip_version integer not null default 1,
  slip_status text not null default 'NotGenerated'
    check (slip_status in ('NotGenerated', 'Generated', 'Published', 'Superseded')),
  email_status text not null default 'NotSent'
    check (email_status in ('NotSent', 'Pending', 'Processing', 'Sent', 'Failed')),
  terms_version_id text not null,
  rule_version_id text not null,
  updated_at timestamptz not null default now(),
  primary key (period_id, staff_id)
);

create table if not exists public.salary_slips (
  id text primary key,
  slip_number text not null,
  period_id text not null,
  staff_id text not null,
  employee_code text not null,
  full_name text not null,
  version integer not null default 1,
  storage_path text,
  net_salary numeric(14, 2) not null default 0,
  net_salary_words text,
  terms_version_id text not null,
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  is_superseded boolean not null default false
);

create table if not exists public.bank_change_requests (
  id text primary key,
  staff_id text not null,
  requester_uid uuid not null,
  account_holder_name text not null,
  bank_name text not null,
  account_number_masked text not null,
  ifsc text not null,
  branch_name text not null,
  account_type text not null check (account_type in ('Savings', 'Current')),
  upi_id text,
  status text not null default 'Pending'
    check (status in ('Pending', 'Verified', 'Rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  rejection_reason text
);

create table if not exists public.email_jobs (
  id text primary key,
  idempotency_key text not null unique,
  period_id text not null,
  staff_id text not null,
  slip_version integer not null default 1,
  recipient_email text not null,
  recipient_name text not null,
  subject text not null,
  status text not null default 'Pending'
    check (status in ('NotSent', 'Pending', 'Processing', 'Sent', 'Failed')),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  actor_uid text,
  actor_email text not null,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  timestamp timestamptz not null default now(),
  details text,
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists public.terms_versions (
  id text primary key,
  version_number text not null,
  title text not null,
  content text not null,
  effective_date date not null,
  status text not null default 'Draft' check (status in ('Draft', 'Published', 'Archived')),
  created_by text not null,
  created_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  content_hash text not null
);

create table if not exists public.company_settings (
  id text primary key,
  company_name text not null,
  registered_address text not null,
  company_email text not null,
  company_phone text not null,
  company_logo_url text,
  salary_slip_footer text not null,
  authorized_signatory_name text not null,
  authorized_signatory_designation text not null,
  payroll_email_sender_name text not null,
  payroll_email_sender_address text not null,
  default_email_template text not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_rule_versions (
  id text primary key,
  version_number text not null,
  cl_allowed_per_month numeric(8, 2) not null default 2,
  el_allowed_within_cl numeric(8, 2) not null default 1,
  excess_el_multiplier numeric(8, 2) not null default 1.5,
  late_allowed_grace integer not null default 2,
  late_penalty_days_per_pair numeric(8, 2) not null default 0.5,
  extra_break_rate_per_hour numeric(14, 2) not null default 50,
  early_leave_rate_per_hour numeric(14, 2) not null default 50,
  extra_hours_rate_per_hour numeric(14, 2) not null default 100,
  holiday_working_day_multiplier numeric(8, 2) not null default 1.5,
  outdoor_work_rate_per_day numeric(14, 2) not null default 500,
  holiday_hourly_rate numeric(14, 2) not null default 150,
  status text not null default 'Active' check (status in ('Active', 'Archived')),
  effective_from date not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

-- Server-only vault: RLS on, no policies, no grants. Service role only.
create table if not exists public.staff_private (
  staff_id text primary key,
  encrypted_payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Resolves the caller's staff document id from their verified email.
-- Defined after the staff table so Postgres can validate the function body.
-- SECURITY DEFINER so it works regardless of the staff table RLS policy.
create or replace function public.my_staff_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.staff s
  where lower(s.google_email) = public.jwt_email()
    and s.status = 'Active'
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.salary_history enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_records enable row level security;
alter table public.salary_slips enable row level security;
alter table public.bank_change_requests enable row level security;
alter table public.email_jobs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.terms_versions enable row level security;
alter table public.company_settings enable row level security;
alter table public.payroll_rule_versions enable row level security;
alter table public.staff_private enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_management());
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- staff
drop policy if exists staff_select on public.staff;
drop policy if exists staff_insert on public.staff;
drop policy if exists staff_update on public.staff;
drop policy if exists staff_delete on public.staff;
create policy staff_select on public.staff
  for select to authenticated
  using (
    public.is_management()
    or lower(google_email) = public.jwt_email()
  );
create policy staff_insert on public.staff
  for insert to authenticated with check (public.is_management());
create policy staff_update on public.staff
  for update to authenticated
  using (public.is_management()) with check (public.is_management());
create policy staff_delete on public.staff
  for delete to authenticated using (public.is_management());

-- salary_history
drop policy if exists salary_history_all on public.salary_history;
create policy salary_history_all on public.salary_history
  for all to authenticated
  using (public.is_management()) with check (public.is_management());

-- payroll_periods
drop policy if exists payroll_periods_select on public.payroll_periods;
drop policy if exists payroll_periods_insert on public.payroll_periods;
drop policy if exists payroll_periods_update on public.payroll_periods;
drop policy if exists payroll_periods_delete on public.payroll_periods;
create policy payroll_periods_select on public.payroll_periods
  for select to authenticated using (true);
create policy payroll_periods_insert on public.payroll_periods
  for insert to authenticated with check (public.is_management());
create policy payroll_periods_update on public.payroll_periods
  for update to authenticated
  using (public.is_management()) with check (public.is_management());
create policy payroll_periods_delete on public.payroll_periods
  for delete to authenticated using (public.is_management());

-- payroll_records (staff see only their own generated/published records)
drop policy if exists payroll_records_select on public.payroll_records;
drop policy if exists payroll_records_insert on public.payroll_records;
drop policy if exists payroll_records_update on public.payroll_records;
drop policy if exists payroll_records_delete on public.payroll_records;
create policy payroll_records_select on public.payroll_records
  for select to authenticated
  using (
    public.is_management()
    or (
      staff_id = public.my_staff_id()
      and slip_status in ('Published', 'Generated')
    )
  );
create policy payroll_records_insert on public.payroll_records
  for insert to authenticated with check (public.is_management());
create policy payroll_records_update on public.payroll_records
  for update to authenticated
  using (public.is_management()) with check (public.is_management());
create policy payroll_records_delete on public.payroll_records
  for delete to authenticated using (public.is_management());

-- salary_slips
drop policy if exists salary_slips_select on public.salary_slips;
drop policy if exists salary_slips_insert on public.salary_slips;
drop policy if exists salary_slips_update on public.salary_slips;
drop policy if exists salary_slips_delete on public.salary_slips;
create policy salary_slips_select on public.salary_slips
  for select to authenticated
  using (public.is_management() or staff_id = public.my_staff_id());
create policy salary_slips_insert on public.salary_slips
  for insert to authenticated with check (public.is_management());
create policy salary_slips_update on public.salary_slips
  for update to authenticated
  using (public.is_management()) with check (public.is_management());
create policy salary_slips_delete on public.salary_slips
  for delete to authenticated using (public.is_management());

-- bank_change_requests
drop policy if exists bank_requests_select on public.bank_change_requests;
drop policy if exists bank_requests_insert on public.bank_change_requests;
drop policy if exists bank_requests_update on public.bank_change_requests;
drop policy if exists bank_requests_delete on public.bank_change_requests;
create policy bank_requests_select on public.bank_change_requests
  for select to authenticated
  using (public.is_management() or requester_uid = auth.uid());
create policy bank_requests_insert on public.bank_change_requests
  for insert to authenticated with check (requester_uid = auth.uid());
create policy bank_requests_update on public.bank_change_requests
  for update to authenticated
  using (public.is_management()) with check (public.is_management());
create policy bank_requests_delete on public.bank_change_requests
  for delete to authenticated using (public.is_super_admin());

-- email_jobs
drop policy if exists email_jobs_all on public.email_jobs;
create policy email_jobs_all on public.email_jobs
  for all to authenticated
  using (public.is_management()) with check (public.is_management());

-- audit_logs (append-only; management can read)
drop policy if exists audit_logs_select on public.audit_logs;
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (public.is_management());
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated with check (auth.uid() is not null);

-- terms_versions
drop policy if exists terms_select on public.terms_versions;
drop policy if exists terms_write on public.terms_versions;
create policy terms_select on public.terms_versions
  for select to authenticated using (true);
create policy terms_write on public.terms_versions
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- company_settings
drop policy if exists company_settings_select on public.company_settings;
drop policy if exists company_settings_write on public.company_settings;
create policy company_settings_select on public.company_settings
  for select to authenticated using (true);
create policy company_settings_write on public.company_settings
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- payroll_rule_versions
drop policy if exists rule_versions_select on public.payroll_rule_versions;
drop policy if exists rule_versions_write on public.payroll_rule_versions;
create policy rule_versions_select on public.payroll_rule_versions
  for select to authenticated using (true);
create policy rule_versions_write on public.payroll_rule_versions
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- staff_private: intentionally no policies (service role only)

-- ---------------------------------------------------------------------------
-- Grants: authenticated only. RLS remains the gate; anonymous has no access.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.staff_private from authenticated;

-- Ask PostgREST to refresh its schema cache after applying this file.
notify pgrst, 'reload schema';
