-- ============================================================================
-- Social Escape Assistant — Rescue Delivery (email/SMS/fake-call)
-- Run via: node scripts/migrate-rescue.js  (idempotent)
-- ============================================================================

insert into public.admin_settings (key, value, category, description) values
  ('rescue_enabled', 'true', 'growth', 'Master switch for the Social Escape rescue delivery (email/SMS/call)'),
  ('rescue_sms_credits', '1', 'growth', 'Credits charged per SMS/voice rescue delivery (0 = free)'),
  ('rescue_email_credits', '0', 'growth', 'Credits charged per email rescue delivery (0 = free)')
on conflict (key) do update set value = excluded.value, description = excluded.description;
