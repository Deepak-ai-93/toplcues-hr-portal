-- Staff lifecycle: rejoin tracking, resignation approval chain, leave applications.

-- ---------------------------------------------------------------------------
-- Rejoin tracking
-- ---------------------------------------------------------------------------

alter table public.staff add column if not exists rejoined_date date;
create index if not exists staff_status_idx on public.staff (status);

-- ---------------------------------------------------------------------------
-- Resignation requests (HR step -> CEO final step)
-- ---------------------------------------------------------------------------

create table if not exists public.resignation_requests (
  id text primary key default gen_random_uuid()::text,
  staff_id text not null references public.staff (id) on delete cascade,
  requested_by_uid uuid,
  requested_by_email text not null,
  requested_by_role text not null check (requested_by_role in ('STAFF', 'HR', 'SUPER_ADMIN')),
  initiator text not null default 'SELF' check (initiator in ('SELF', 'ON_BEHALF')),
  reason text not null check (length(btrim(reason)) > 0),
  last_working_date date not null,
  status text not null default 'PENDING_HR'
    check (status in ('PENDING_HR', 'PENDING_CEO', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  hr_reviewed_by text,
  hr_reviewed_at timestamptz,
  hr_note text,
  ceo_reviewed_by text,
  ceo_reviewed_at timestamptz,
  ceo_note text,
  rejected_by text,
  rejected_at timestamptz,
  rejection_stage text check (rejection_stage in ('HR', 'CEO')),
  rejection_note text,
  withdrawn_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists resignation_requests_one_active_idx
  on public.resignation_requests (staff_id)
  where status in ('PENDING_HR', 'PENDING_CEO');
create index if not exists resignation_requests_staff_idx
  on public.resignation_requests (staff_id, submitted_at desc);
create index if not exists resignation_requests_status_idx
  on public.resignation_requests (status, submitted_at desc);

-- ---------------------------------------------------------------------------
-- Leave requests (whole-day, single calendar month)
-- ---------------------------------------------------------------------------

create table if not exists public.leave_requests (
  id text primary key default gen_random_uuid()::text,
  staff_id text not null references public.staff (id) on delete cascade,
  leave_type text not null check (leave_type in ('CL', 'EL', 'LWP')),
  start_date date not null,
  end_date date not null,
  days numeric(5, 2) not null check (days > 0),
  leave_month text not null check (leave_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  reason text not null default '',
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  applied_by_uid uuid,
  applied_by_email text not null,
  applied_on_behalf boolean not null default false,
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_date_order check (end_date >= start_date),
  constraint leave_requests_same_month check (
    leave_month = to_char(start_date, 'YYYY-MM')
    and leave_month = to_char(end_date, 'YYYY-MM')
  ),
  constraint leave_requests_days_match check (days = (end_date - start_date + 1))
);

create index if not exists leave_requests_staff_month_idx
  on public.leave_requests (staff_id, leave_month, status);
create index if not exists leave_requests_status_idx
  on public.leave_requests (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Resolves a staff id by email regardless of status (read access after leaving).
create or replace function public.my_staff_id_any()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.staff s
  where lower(s.google_email) = public.jwt_email()
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: select-only tables; writes happen through RPCs.
-- ---------------------------------------------------------------------------

alter table public.resignation_requests enable row level security;
alter table public.leave_requests enable row level security;

drop policy if exists resignation_requests_select on public.resignation_requests;
create policy resignation_requests_select on public.resignation_requests
  for select to authenticated
  using (public.is_management() or staff_id = public.my_staff_id_any());

drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (public.is_management() or staff_id = public.my_staff_id_any());

revoke all on public.resignation_requests, public.leave_requests from anon;
grant select on public.resignation_requests, public.leave_requests to authenticated;
revoke insert, update, delete on public.resignation_requests, public.leave_requests from authenticated;

-- ---------------------------------------------------------------------------
-- Leave RPCs
-- ---------------------------------------------------------------------------

create or replace function public.apply_leave(
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_reason text,
  p_staff_id text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_uid uuid := auth.uid();
  v_actor_email text := public.jwt_email();
  v_staff_id text;
  v_on_behalf boolean := false;
  v_days numeric;
  v_month text;
  v_row public.leave_requests;
  v_cl_allow numeric := 7;
  v_el_allow numeric := 1;
  v_cl_days numeric := 0;
  v_el_days numeric := 0;
begin
  if p_leave_type is null or p_leave_type not in ('CL', 'EL', 'LWP') then
    raise exception 'Invalid leave type.';
  end if;
  if p_start_date is null or p_end_date is null then
    raise exception 'Start and end dates are required.';
  end if;
  if p_end_date < p_start_date then
    raise exception 'End date must be on or after the start date.';
  end if;
  if to_char(p_start_date, 'YYYY-MM') <> to_char(p_end_date, 'YYYY-MM') then
    raise exception 'Leave must start and end within the same calendar month.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required.';
  end if;

  if p_staff_id is null then
    v_staff_id := public.my_staff_id();
    if v_staff_id is null then
      raise exception 'Only active staff can apply for leave.';
    end if;
  else
    if not public.is_management() then
      raise exception 'You can only apply for your own leave.';
    end if;
    v_staff_id := p_staff_id;
    v_on_behalf := true;
  end if;

  if not exists (
    select 1 from public.staff s where s.id = v_staff_id and s.status = 'Active'
  ) then
    raise exception 'Staff member is not active.';
  end if;

  if not v_on_behalf and p_start_date < current_date then
    raise exception 'Leave cannot be requested for past dates.';
  end if;

  v_days := (p_end_date - p_start_date + 1);
  v_month := to_char(p_start_date, 'YYYY-MM');

  perform pg_advisory_xact_lock(hashtext(v_staff_id || ':' || v_month)::bigint);

  if exists (
    select 1
    from public.leave_requests lr
    where lr.staff_id = v_staff_id
      and lr.status in ('PENDING', 'APPROVED')
      and daterange(lr.start_date, lr.end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
  ) then
    raise exception 'This leave period overlaps an existing pending or approved request.';
  end if;

  select coalesce(cl_allowed_per_month, 7), coalesce(el_allowed_within_cl, 1)
    into v_cl_allow, v_el_allow
  from public.payroll_rule_versions
  where status = 'Active'
  order by effective_from desc, updated_at desc
  limit 1;

  v_cl_allow := coalesce(v_cl_allow, 7);
  v_el_allow := coalesce(v_el_allow, 1);

  select
    coalesce(sum(lr.days) filter (where lr.leave_type = 'CL'), 0),
    coalesce(sum(lr.days) filter (where lr.leave_type = 'EL'), 0)
    into v_cl_days, v_el_days
  from public.leave_requests lr
  where lr.staff_id = v_staff_id
    and lr.leave_month = v_month
    and lr.status in ('PENDING', 'APPROVED');

  if p_leave_type = 'CL' then v_cl_days := v_cl_days + v_days; end if;
  if p_leave_type = 'EL' then v_el_days := v_el_days + v_days; end if;

  if v_el_days > v_el_allow then
    raise exception 'EL limit exceeded: % day(s) requested against % allowed (pending + approved) in %.',
      v_days, v_el_allow, v_month;
  end if;
  if v_cl_days + least(v_el_days, v_el_allow) > v_cl_allow then
    raise exception 'CL limit exceeded: CL % + EL % (within CL allowance %) exceeds % days in %.',
      v_cl_days, least(v_el_days, v_el_allow), v_el_allow, v_cl_allow, v_month;
  end if;

  insert into public.leave_requests (
    staff_id, leave_type, start_date, end_date, days, leave_month, reason, status,
    applied_by_uid, applied_by_email, applied_on_behalf
  ) values (
    v_staff_id, p_leave_type, p_start_date, p_end_date, v_days, v_month,
    btrim(p_reason), 'PENDING', v_actor_uid, v_actor_email, v_on_behalf
  )
  returning * into v_row;

  insert into public.audit_logs (actor_uid, actor_email, actor_role, action, entity_type, entity_id, details)
  values (
    coalesce(v_actor_uid::text, 'SYSTEM'), v_actor_email, coalesce(public.my_role(), 'STAFF'),
    'APPLY_LEAVE', 'LEAVE', v_row.id,
    jsonb_build_object('staffId', v_staff_id, 'type', p_leave_type, 'start', p_start_date, 'end', p_end_date, 'days', v_days)::text
  );

  return v_row;
end;
$$;

create or replace function public.review_leave(
  p_request_id text,
  p_decision text,
  p_note text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.leave_requests;
  v_cl_allow numeric := 7;
  v_el_allow numeric := 1;
  v_cl_days numeric := 0;
  v_el_days numeric := 0;
begin
  if not public.is_management() then
    raise exception 'Only HR or Super Admin can review leave requests.';
  end if;
  if p_decision not in ('APPROVE', 'REJECT') then
    raise exception 'Invalid review decision.';
  end if;

  select * into v_row from public.leave_requests where id = p_request_id for update;
  if not found then raise exception 'Leave request not found.'; end if;
  if v_row.status <> 'PENDING' then
    raise exception 'This request is already %.', v_row.status;
  end if;
  if v_row.staff_id = public.my_staff_id() then
    raise exception 'You cannot review your own leave request.';
  end if;

  if p_decision = 'REJECT' then
    if length(btrim(coalesce(p_note, ''))) = 0 then
      raise exception 'A rejection note is required.';
    end if;
    update public.leave_requests
    set status = 'REJECTED', reviewed_by = public.jwt_email(), reviewed_at = now(),
        review_note = btrim(p_note), updated_at = now()
    where id = p_request_id
    returning * into v_row;

    insert into public.audit_logs (actor_uid, actor_email, actor_role, action, entity_type, entity_id, details)
    values (
      coalesce(auth.uid()::text, 'SYSTEM'), public.jwt_email(), coalesce(public.my_role(), 'HR'),
      'REJECT_LEAVE', 'LEAVE', v_row.id,
      jsonb_build_object('staffId', v_row.staff_id, 'type', v_row.leave_type, 'note', p_note)::text
    );
    return v_row;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_row.staff_id || ':' || v_row.leave_month)::bigint);

  select coalesce(cl_allowed_per_month, 7), coalesce(el_allowed_within_cl, 1)
    into v_cl_allow, v_el_allow
  from public.payroll_rule_versions
  where status = 'Active'
  order by effective_from desc, updated_at desc
  limit 1;

  v_cl_allow := coalesce(v_cl_allow, 7);
  v_el_allow := coalesce(v_el_allow, 1);

  select
    coalesce(sum(lr.days) filter (where lr.leave_type = 'CL'), 0),
    coalesce(sum(lr.days) filter (where lr.leave_type = 'EL'), 0)
    into v_cl_days, v_el_days
  from public.leave_requests lr
  where lr.staff_id = v_row.staff_id
    and lr.leave_month = v_row.leave_month
    and lr.status in ('PENDING', 'APPROVED')
    and lr.id <> v_row.id;

  if v_row.leave_type = 'CL' then v_cl_days := v_cl_days + v_row.days; end if;
  if v_row.leave_type = 'EL' then v_el_days := v_el_days + v_row.days; end if;

  if v_el_days > v_el_allow then
    raise exception 'Cannot approve: EL % day(s) would exceed the % allowed for %.', v_el_days, v_el_allow, v_row.leave_month;
  end if;
  if v_cl_days + least(v_el_days, v_el_allow) > v_cl_allow then
    raise exception 'Cannot approve: CL % + EL % exceeds the % day CL allowance for %.',
      v_cl_days, least(v_el_days, v_el_allow), v_cl_allow, v_row.leave_month;
  end if;

  update public.leave_requests
  set status = 'APPROVED', reviewed_by = public.jwt_email(), reviewed_at = now(),
      review_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
  where id = p_request_id
  returning * into v_row;

  insert into public.audit_logs (actor_uid, actor_email, actor_role, action, entity_type, entity_id, details)
  values (
    coalesce(auth.uid()::text, 'SYSTEM'), public.jwt_email(), coalesce(public.my_role(), 'HR'),
    'APPROVE_LEAVE', 'LEAVE', v_row.id,
    jsonb_build_object('staffId', v_row.staff_id, 'type', v_row.leave_type, 'days', v_row.days)::text
  );

  return v_row;
end;
$$;

create or replace function public.cancel_leave(p_request_id text)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.leave_requests;
begin
  select * into v_row from public.leave_requests where id = p_request_id for update;
  if not found then raise exception 'Leave request not found.'; end if;
  if not (public.is_management() or v_row.staff_id = public.my_staff_id()) then
    raise exception 'You can only cancel your own leave request.';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Only pending requests can be cancelled.';
  end if;

  update public.leave_requests
  set status = 'CANCELLED', cancelled_at = now(), updated_at = now()
  where id = p_request_id
  returning * into v_row;

  insert into public.audit_logs (actor_uid, actor_email, actor_role, action, entity_type, entity_id, details)
  values (
    coalesce(auth.uid()::text, 'SYSTEM'), public.jwt_email(), coalesce(public.my_role(), 'STAFF'),
    'CANCEL_LEAVE', 'LEAVE', v_row.id,
    jsonb_build_object('staffId', v_row.staff_id, 'days', v_row.days)::text
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resignation RPCs
-- ---------------------------------------------------------------------------

create or replace function public.submit_resignation(
  p_last_working_date date,
  p_reason text,
  p_staff_id text default null
)
returns public.resignation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_uid uuid := auth.uid();
  v_actor_email text := public.jwt_email();
  v_staff_id text;
  v_on_behalf boolean := false;
  v_row public.resignation_requests;
begin
  if p_last_working_date is null then
    raise exception 'Last working date is required.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A resignation reason is required.';
  end if;

  if p_staff_id is null then
    v_staff_id := public.my_staff_id();
    if v_staff_id is null then
      raise exception 'Only active staff can submit a resignation.';
    end if;
  else
    if not public.is_management() then
      raise exception 'You can only submit your own resignation.';
    end if;
    v_staff_id := p_staff_id;
    v_on_behalf := true;
  end if;

  if not exists (
    select 1 from public.staff s where s.id = v_staff_id and s.status = 'Active'
  ) then
    raise exception 'Staff member is not active.';
  end if;

  if not v_on_behalf and p_last_working_date < current_date then
    raise exception 'Last working date cannot be in the past.';
  end if;

  if exists (
    select 1 from public.resignation_requests r
    where r.staff_id = v_staff_id and r.status in ('PENDING_HR', 'PENDING_CEO')
  ) then
    raise exception 'This staff member already has a resignation awaiting approval.';
  end if;

  insert into public.resignation_requests (
    staff_id, requested_by_uid, requested_by_email, requested_by_role, initiator,
    reason, last_working_date, status
  ) values (
    v_staff_id, v_actor_uid, v_actor_email, coalesce(public.my_role(), 'STAFF'),
    case when v_on_behalf then 'ON_BEHALF' else 'SELF' end,
    btrim(p_reason), p_last_working_date, 'PENDING_HR'
  )
  returning * into v_row;

  insert into public.audit_logs (actor_uid, actor_email, actor_role, action, entity_type, entity_id, details)
  values (
    coalesce(v_actor_uid::text, 'SYSTEM'), v_actor_email, coalesce(public.my_role(), 'STAFF'),
    'SUBMIT_RESIGNATION', 'RESIGNATION', v_row.id,
    jsonb_build_object('staffId', v_staff_id, 'lastWorkingDate', p_last_working_date, 'initiator', v_row.initiator)::text
  );

  return v_row;
end;
$$;

create or replace function public.review_resignation(
  p_request_id text,
  p_decision text,
  p_note text default null
)
returns public.resignation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.resignation_requests;
  v_stage text;
begin
  if not public.is_management() then
    raise exception 'Only HR or Super Admin can review resignations.';
  end if;
  if p_decision not in ('APPROVE', 'REJECT') then
    raise exception 'Invalid review decision.';
  end if;

  select * into v_row from public.resignation_requests where id = p_request_id for update;
  if not found then raise exception 'Resignation request not found.'; end if;
  if v_row.status not in ('PENDING_HR', 'PENDING_CEO') then
    raise exception 'This resignation is already %.', v_row.status;
  end if;
  if v_row.staff_id = public.my_staff_id() then
    raise exception 'You cannot review your own resignation.';
  end if;

  if v_row.status = 'PENDING_HR' then
    if not public.is_hr() then
      raise exception 'The first approval step must be performed by HR.';
    end if;
    v_stage := 'HR';
  else
    if not public.is_super_admin() then
      raise exception 'Final approval must be performed by the CEO.';
    end if;
    v_stage := 'CEO';
  end if;

  if p_decision = 'REJECT' then
    if length(btrim(coalesce(p_note, ''))) = 0 then
      raise exception 'A rejection note is required.';
    end if;
    update public.resignation_requests
    set status = 'REJECTED', rejected_by = public.jwt_email(), rejected_at = now(),
        rejection_stage = v_stage, rejection_note = btrim(p_note), updated_at = now()
    where id = p_request_id
    returning * into v_row;

    insert into public.audit_logs (actor_uid, actor_email, actor_role, action, entity_type, entity_id, details)
    values (
      coalesce(auth.uid()::text, 'SYSTEM'), public.jwt_email(), coalesce(public.my_role(), 'HR'),
      'REJECT_RESIGNATION', 'RESIGNATION', v_row.id,
      jsonb_build_object('staffId', v_row.staff_id, 'stage', v_stage, 'note', p_note)::text
    );
    return v_row;
  end if;

  if v_stage = 'HR' then
    update public.resignation_requests
    set status = 'PENDING_CEO', hr_reviewed_by = public.jwt_email(), hr_reviewed_at = now(),
        hr_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
    where id = p_request_id
    returning * into v_row;

    insert into public.audit_logs (actor_uid, actor_email, actor_role, action, entity_type, entity_id, details)
    values (
      coalesce(auth.uid()::text, 'SYSTEM'), public.jwt_email(), coalesce(public.my_role(), 'HR'),
      'HR_APPROVE_RESIGNATION', 'RESIGNATION', v_row.id,
      jsonb_build_object('staffId', v_row.staff_id, 'lastWorkingDate', v_row.last_working_date)::text
    );
    return v_row;
  end if;

  update public.resignation_requests
  set status = 'APPROVED', ceo_reviewed_by = public.jwt_email(), ceo_reviewed_at = now(),
      ceo_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
  where id = p_request_id
  returning * into v_row;

  update public.staff
  set status = 'Left', leaving_date = v_row.last_working_date,
      leaving_reason = v_row.reason, updated_at = now()
  where id = v_row.staff_id;

  update public.leave_requests
  set status = 'CANCELLED', cancelled_at = now(), updated_at = now()
  where staff_id = v_row.staff_id and status = 'PENDING';

  insert into public.audit_logs (actor_uid, actor_email, actor_role, action, entity_type, entity_id, details)
  values (
    coalesce(auth.uid()::text, 'SYSTEM'), public.jwt_email(), coalesce(public.my_role(), 'SUPER_ADMIN'),
    'CEO_APPROVE_RESIGNATION', 'RESIGNATION', v_row.id,
    jsonb_build_object('staffId', v_row.staff_id, 'lastWorkingDate', v_row.last_working_date)::text
  );

  return v_row;
end;
$$;

create or replace function public.withdraw_resignation(p_request_id text)
returns public.resignation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.resignation_requests;
begin
  select * into v_row from public.resignation_requests where id = p_request_id for update;
  if not found then raise exception 'Resignation request not found.'; end if;
  if not (
    public.is_management()
    or v_row.staff_id = public.my_staff_id()
    or v_row.requested_by_uid = auth.uid()
  ) then
    raise exception 'You can only withdraw your own resignation request.';
  end if;
  if v_row.status not in ('PENDING_HR', 'PENDING_CEO') then
    raise exception 'Only pending resignations can be withdrawn.';
  end if;

  update public.resignation_requests
  set status = 'WITHDRAWN', withdrawn_at = now(), updated_at = now()
  where id = p_request_id
  returning * into v_row;

  insert into public.audit_logs (actor_uid, actor_email, actor_role, action, entity_type, entity_id, details)
  values (
    coalesce(auth.uid()::text, 'SYSTEM'), public.jwt_email(), coalesce(public.my_role(), 'STAFF'),
    'WITHDRAW_RESIGNATION', 'RESIGNATION', v_row.id,
    jsonb_build_object('staffId', v_row.staff_id)::text
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rejoin RPC
-- ---------------------------------------------------------------------------

create or replace function public.reactivate_staff(
  p_staff_id text,
  p_rejoined_date date,
  p_note text default null
)
returns public.staff
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff;
begin
  if not public.is_management() then
    raise exception 'Only HR or Super Admin can rejoin staff.';
  end if;
  if p_rejoined_date is null then
    raise exception 'Rejoin date is required.';
  end if;

  select * into v_staff from public.staff where id = p_staff_id for update;
  if not found then raise exception 'Staff member not found.'; end if;
  if v_staff.status = 'Active' then
    raise exception 'Staff member is already active.';
  end if;
  if v_staff.leaving_date is not null and p_rejoined_date < v_staff.leaving_date then
    raise exception 'Rejoin date cannot be before the leaving date.';
  end if;

  update public.staff
  set status = 'Active', rejoined_date = p_rejoined_date,
      notes = case
        when p_note is null or length(btrim(p_note)) = 0 then v_staff.notes
        when v_staff.notes is null or length(btrim(v_staff.notes)) = 0 then btrim(p_note)
        else v_staff.notes || E'\n' || btrim(p_note)
      end,
      updated_at = now()
  where id = p_staff_id
  returning * into v_staff;

  insert into public.audit_logs (actor_uid, actor_email, actor_role, action, entity_type, entity_id, details)
  values (
    coalesce(auth.uid()::text, 'SYSTEM'), public.jwt_email(), coalesce(public.my_role(), 'HR'),
    'REJOIN_STAFF', 'STAFF', p_staff_id,
    jsonb_build_object('rejoinedDate', p_rejoined_date, 'note', p_note)::text
  );

  return v_staff;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------------

revoke all on function public.apply_leave(text, date, date, text, text) from public, anon;
revoke all on function public.review_leave(text, text, text) from public, anon;
revoke all on function public.cancel_leave(text) from public, anon;
revoke all on function public.submit_resignation(date, text, text) from public, anon;
revoke all on function public.review_resignation(text, text, text) from public, anon;
revoke all on function public.withdraw_resignation(text) from public, anon;
revoke all on function public.reactivate_staff(text, date, text) from public, anon;

grant execute on function public.apply_leave(text, date, date, text, text) to authenticated;
grant execute on function public.review_leave(text, text, text) to authenticated;
grant execute on function public.cancel_leave(text) to authenticated;
grant execute on function public.submit_resignation(date, text, text) to authenticated;
grant execute on function public.review_resignation(text, text, text) to authenticated;
grant execute on function public.withdraw_resignation(text) to authenticated;
grant execute on function public.reactivate_staff(text, date, text) to authenticated;

notify pgrst, 'reload schema';
