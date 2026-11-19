begin;

alter table public.users
  add column if not exists company text,
  add column if not exists field text,
  add column if not exists last_login timestamptz;

create table if not exists public.admin_credentials (
  email text primary key,
  password_hash text not null,
  current_token_hash text unique,
  session_expires_at timestamptz,
  last_login timestamptz,
  password_changed_at timestamptz
);

alter table public.admin_credentials enable row level security;
revoke all on public.admin_credentials from public, anon, authenticated;
grant select, insert, update on public.admin_credentials to service_role;

create or replace function public.register_mentora_profile(p_user jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  profile public.users;
  phone_digits text := regexp_replace(coalesce(p_user->>'phone', ''), '[^0-9]', '', 'g');
  field_name text := coalesce(nullif(p_user->>'field', ''), 'Finance & Taxation');
  base_rate numeric := (p_user->>'base_rate')::numeric;
begin
  if phone_digits <> '' then
    perform pg_advisory_xact_lock(hashtext('mentora-registration:' || phone_digits));
    if exists (select 1 from public.users where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = phone_digits) then
      raise unique_violation using message = 'Phone number already registered';
    end if;
  end if;

  insert into public.users (id, email, full_name, password_hash, role, phone, company, field, bio, is_verified)
  values ((p_user->>'id')::uuid, p_user->>'email', p_user->>'full_name', p_user->>'password_hash',
    p_user->>'role', nullif(p_user->>'phone', ''), p_user->>'company', field_name, p_user->>'bio', p_user->>'role' = 'client')
  returning * into profile;

  if profile.role = 'expert' then
    insert into public.experts (id, user_id, name, email, field, title, phone, bio, years_of_experience,
      base_rate, admin_markup, rate, project_rate, verified, skills, documents)
    values (profile.id::text, profile.id, profile.full_name, profile.email, field_name, p_user->>'title',
      profile.phone, profile.bio, (p_user->>'years')::int, base_rate, 150, base_rate + 150, 1500, false,
      array[field_name], jsonb_build_object('status', 'pending', 'verificationStatus', 'pending', 'company', profile.company, 'items', '{}'::jsonb));
  end if;

  return to_jsonb(profile) - 'password_hash';
end;
$$;

revoke all on function public.register_mentora_profile(jsonb) from public, anon, authenticated;
grant execute on function public.register_mentora_profile(jsonb) to service_role;

commit;
