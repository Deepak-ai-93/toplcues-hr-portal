-- Authorize dbagada910@gmail.com as an active staff member.
-- Any active staff row whose google_email matches the verified Google account
-- resolves to the STAFF role (see public.my_staff_id and the staff RLS policy).
do $$
declare
  existing_id text;
begin
  select id into existing_id
  from public.staff
  where lower(google_email) = 'dbagada910@gmail.com';

  if existing_id is not null then
    update public.staff
    set status = 'Active',
        updated_at = now()
    where id = existing_id;
  else
    insert into public.staff (
      id,
      employee_code,
      full_name,
      google_email,
      department,
      designation,
      date_of_joining,
      employment_type,
      work_location,
      monthly_salary,
      salary_effective_date,
      status,
      bank_verification_status
    ) values (
      'staff_dbagada910',
      'TCS-104',
      'Deepak Bagada',
      'dbagada910@gmail.com',
      'Engineering',
      'Staff Member',
      '2026-11-02',
      'Full-Time',
      'Bengaluru HQ',
      0,
      '2026-11-02',
      'Active',
      'Pending'
    );
  end if;
end
$$;
