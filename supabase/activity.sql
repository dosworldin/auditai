-- ============================================================================
-- Admin live activity feed + notification emails
-- Run via: node scripts/migrate-activity.js  (idempotent)
-- ============================================================================

create table if not exists public.admin_activity (
  id bigint generated always as identity primary key,
  event_type text not null,           -- signup | support_ticket | payout_request | payment_request | storybook_order | audit_run | lab_run | referral_join
  summary text not null,              -- human-readable one-liner
  detail jsonb,                       -- flexible payload (emails, amounts, ids)
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_created_idx
  on public.admin_activity (created_at desc);

alter table public.admin_activity enable row level security;

-- Service role only (no public policies).

-- ----------------------------------------------------------------------------
-- Signup capture: a SECURITY DEFINER trigger on auth.users records every new
-- signup into the feed (bypasses RLS; works no matter how the user signs up).
-- ----------------------------------------------------------------------------
create or replace function public.notify_admin_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_activity (event_type, summary, detail)
  values (
    'signup',
    'New user signup: ' || coalesce(new.email, new.id::text),
    jsonb_build_object('email', new.email, 'user_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_notify on auth.users;
create trigger on_auth_user_created_notify
  after insert on auth.users
  for each row execute function public.notify_admin_signup();

-- ----------------------------------------------------------------------------
-- Settings: admin notification email + toggle
-- ----------------------------------------------------------------------------
insert into public.admin_settings (key, value, category, description) values
  ('admin_notify_email', 'null'::jsonb, 'general', 'Email address that receives live platform activity notifications (set in Admin → Settings)'),
  ('admin_notify_enabled', 'true'::jsonb, 'general', 'Master switch for admin activity notification emails')
on conflict (key) do nothing;
