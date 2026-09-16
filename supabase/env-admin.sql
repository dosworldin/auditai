-- ============================================================================
-- Admin-managed credentials + signup bonus
-- Run via: node scripts/migrate-env-admin.js  (idempotent)
-- ============================================================================

-- Service-role-only table for secrets. NOT exposed through any public API;
-- only API routes that hold SUPABASE_SERVICE_ROLE_KEY can read it.
create table if not exists public.secret_admin_settings (
  key text primary key,
  value text not null,
  category text not null default 'credentials',
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- No RLS policies => only service_role (bypasses RLS) and table owner can read.
alter table public.secret_admin_settings enable row level security;

-- Signup welcome credits — admin adjustable, read by the profile-creation trigger.
insert into public.admin_settings (key, value, category, description) values
  ('signup_bonus_credits', '100', 'billing', 'Welcome credits granted to every new user at signup')
on conflict (key) do nothing;

-- Profile trigger: read the bonus from admin_settings instead of a hardcoded
-- column default. Falls back to 100 if the setting is missing.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  bonus numeric(12,2);
begin
  select coalesce((select (value)::numeric from public.admin_settings where key = 'signup_bonus_credits'), 100)
  into bonus;

  insert into public.profiles (id, email, display_name, referral_code, credits)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'R' || upper(substr(md5(random()::text || new.id::text), 1, 6)),
    bonus
  );
  return new;
end;
$$ language plpgsql security definer;

-- (Trigger on_auth_user_created already exists; create-or-replace of the
-- function is enough — no need to recreate the trigger.)
