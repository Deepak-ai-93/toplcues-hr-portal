-- Signature image (PNG data URL) rendered on generated salary slips.
alter table public.company_settings
  add column if not exists authorized_signatory_signature_url text not null default '';

notify pgrst, 'reload schema';
