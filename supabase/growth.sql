-- ============================================================================
-- Invite + Referral growth engine (admin coupons, tiered rewards)
-- Run via: node scripts/migrate-growth.js  (idempotent)
--
-- Reward model (admin adjustable in Admin → Growth):
--   Direct organic signup          → signup_bonus_credits only (base, kam)
--   Signup via shared link/coupon  → signup bonus + referral_bonus_credits
--                                     (jyada) AND the inviter gets
--                                     referral_inviter_bonus_credits
-- ============================================================================

-- Admin-generated invite/coupon codes.
--   type = 'invite' → tied to an owner (created_by); owner earns the inviter
--                     bonus when the code is used.
--   type = 'open'   → pure promotion (e.g. WELCOME100); only the new user
--                     gets the referral bonus, no inviter.
create table if not exists public.invite_codes (
  code text primary key,
  type text not null default 'invite' check (type in ('invite', 'open')),
  created_by uuid references public.profiles(id),
  max_uses integer,
  uses integer not null default 0,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

-- Only the service role touches this table (admin API + signup flow).
-- No anon/authenticated policies on purpose.

-- ----------------------------------------------------------------------------
-- Reward settings (admin adjustable)
-- ----------------------------------------------------------------------------
delete from public.admin_settings
where key in ('referral_direct_bonus_credits', 'referral_direct_inviter_bonus_credits');

insert into public.admin_settings (key, value, category, description) values
  ('referral_enabled', 'true', 'growth', 'Master switch for invite + referral rewards'),
  ('referral_bonus_credits', '100', 'growth', 'Extra credits the NEW user gets when they join via a shared link or coupon (on top of the signup bonus)'),
  ('referral_inviter_bonus_credits', '100', 'growth', 'Credits the inviter earns when someone joins through their link or invite code')
on conflict (key) do update set value = excluded.value, description = excluded.description;
