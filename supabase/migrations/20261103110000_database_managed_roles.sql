-- Database-managed role assignments.
-- Management roles become data (public.user_roles) instead of hardcoded emails,
-- so Super Admin access is granted at the database level.

create table if not exists public.user_roles (
  email text primary key,
  role text not null check (role in ('SUPER_ADMIN', 'HR')),
  granted_by text,
  created_at timestamptz not null default now()
);

insert into public.user_roles (email, role, granted_by)
values
  ('ceo@topclues.in', 'SUPER_ADMIN', 'system'),
  ('dbagada910@gmail.com', 'SUPER_ADMIN', 'system'),
  ('unicorn@topclues.in', 'HR', 'system'),
  ('marketing@topclues.in', 'HR', 'system')
on conflict (email) do update set role = excluded.role;

alter table public.user_roles enable row level security;

drop policy if exists user_roles_select on public.user_roles;
drop policy if exists user_roles_write on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated using (public.is_management());
create policy user_roles_write on public.user_roles
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

revoke all on public.user_roles from anon;
grant select, insert, update, delete on public.user_roles to authenticated;

create or replace function public.role_for_email(p_email text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select r.role
      from public.user_roles r
      where lower(r.email) = lower(p_email)
      limit 1
    ),
    case
      when exists (
        select 1
        from public.staff s
        where lower(s.google_email) = lower(p_email)
          and s.status = 'Active'
      ) then 'STAFF'
    end
  );
$$;

revoke all on function public.role_for_email(text) from public;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.role_for_email(public.jwt_email());
$$;

grant execute on function public.my_role() to authenticated;

-- Authorization checks now read the role table.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles r
    where lower(r.email) = public.jwt_email()
      and r.role = 'SUPER_ADMIN'
  );
$$;

create or replace function public.is_hr()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles r
    where lower(r.email) = public.jwt_email()
      and r.role = 'HR'
  );
$$;

notify pgrst, 'reload schema';
