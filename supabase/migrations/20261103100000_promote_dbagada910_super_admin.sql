-- Promote dbagada910@gmail.com from staff to Super Admin.
-- Replaces the staff mapping added in 20261102170100.

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.jwt_email() in ('ceo@topclues.in', 'dbagada910@gmail.com');
$$;

-- The account is management, not staff: remove the staff identity so
-- public.my_staff_id() and the staff self-service policies no longer apply.
delete from public.salary_slips
where staff_id in (
  select id from public.staff where lower(google_email) = 'dbagada910@gmail.com'
);

delete from public.staff
where lower(google_email) = 'dbagada910@gmail.com';

update public.profiles
set role = 'SUPER_ADMIN',
    is_active = true
where lower(email) = 'dbagada910@gmail.com';
