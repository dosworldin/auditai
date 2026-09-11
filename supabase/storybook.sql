-- ============================================================================
-- AI Storybooks — production tables, storage, settings
-- Run via: node scripts/migrate-storybook.js  (idempotent)
-- ============================================================================

create table if not exists public.storybook_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft','story_ready','illustrating','composing_pdf','ready','failed')),
  -- Story configuration
  child_name text not null,
  child_age integer,
  gender text not null default 'unspecified',
  theme text not null default 'adventure',
  art_style text not null default 'watercolor',
  language text not null default 'en',
  page_count integer not null default 10,
  dedication text,
  story_idea text,
  -- Parental consent (required, never generated without it)
  consent boolean not null default false,
  -- Pipeline state
  photo_path text,
  story_json jsonb,
  leonardo_ref_image_id text,
  pages jsonb not null default '[]'::jsonb,
  pdf_path text,
  share_slug text unique,
  provider text,
  error_message text,
  credits_spent integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storybook_orders_user_idx
  on public.storybook_orders (user_id, created_at desc);
create index if not exists storybook_orders_status_idx
  on public.storybook_orders (status) where status not in ('ready','failed');

-- ---------------------------------------------------------------------------
-- Later additions (idempotent ALTERs — safe to re-run on existing tables)
-- ---------------------------------------------------------------------------
alter table public.storybook_orders add column if not exists voice_requested boolean not null default false;
alter table public.storybook_orders add column if not exists voice_status text;
alter table public.storybook_orders add column if not exists voice_name text;
alter table public.storybook_orders add column if not exists narration jsonb not null default '{}'::jsonb;
alter table public.storybook_orders add column if not exists pod_job_id text;
alter table public.storybook_orders add column if not exists pod_status text;

-- AI story-writer outputs (text-only stories written by the AI tool)
create table if not exists public.storybook_ai_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  words integer not null default 0,
  language text not null default 'en',
  provider text,
  created_at timestamptz not null default now()
);
create index if not exists storybook_ai_stories_user_idx
  on public.storybook_ai_stories (user_id, created_at desc);
alter table public.storybook_ai_stories enable row level security;
create policy "Users manage own AI stories"
  on public.storybook_ai_stories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Admins read all AI stories"
  on public.storybook_ai_stories for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Paid story-fit analyses
create table if not exists public.storybook_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  result jsonb not null default '{}'::jsonb,
  words integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists storybook_analyses_user_idx
  on public.storybook_analyses (user_id, created_at desc);
alter table public.storybook_analyses enable row level security;
create policy "Users manage own analyses"
  on public.storybook_analyses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Admins read all analyses"
  on public.storybook_analyses for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

alter table public.storybook_orders enable row level security;

create policy "Users manage own storybook orders"
  on public.storybook_orders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins read all storybook orders"
  on public.storybook_orders for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Private bucket for children's photos + generated PDFs.
-- All server-side access goes through the service-role client; end users only
-- ever receive short-lived signed URLs. No direct anon/authenticated access.
insert into storage.buckets (id, name, public) values ('storybook-assets', 'storybook-assets', false)
on conflict (id) do nothing;

-- Admin/runtime settings
insert into public.admin_settings (key, value, category, description) values
  ('storybook_enabled', 'true', 'storybook', 'Enable the AI Storybooks product'),
  ('storybook_pdf_credits', '25', 'storybook', 'Credits for a full storybook (story + illustrations + PDF)'),
  ('storybook_regenerate_page_credits', '2', 'storybook', 'Credits to regenerate a single illustration after the first free retry'),
  ('storybook_default_page_count', '10', 'storybook', 'Default number of illustrated pages'),
  ('storybook_min_page_count', '6', 'storybook', 'Minimum pages allowed'),
  ('storybook_max_page_count', '16', 'storybook', 'Maximum pages allowed'),
  ('storybook_photo_retention_days', '7', 'storybook', 'Days to keep the uploaded child photo (0 = delete immediately after generation)'),
  ('storybook_image_provider', '"gemini"', 'storybook', 'Illustration provider order: "gemini" (direct Google Gemini image first, Leonardo fallback) or "leonardo"'),
  ('storybook_voice_enabled', 'true', 'storybook', 'Premium add-on: AI voice narration (Gemini TTS)'),
  ('storybook_voice_credits', '10', 'storybook', 'Credits for full voice narration of a storybook (charged once per book)'),
  ('storybook_samples_enabled', 'true', 'storybook', 'Show readymade sample storybooks (no AI cost per view)'),
  ('storybook_public_preview_pages', '3', 'storybook', 'Free preview pages visible on public share links'),
  ('storybook_analysis_credits', '3', 'storybook', 'Credits for a paid AI story-fit analysis'),
  ('storybook_ai_story_credits', '2', 'storybook', 'Credits per AI story-writer run (text only)'),
  ('storybook_pod_enabled', 'true', 'storybook', 'Printed copies via print-on-demand (Lulu Direct)'),
  ('storybook_pod_credits', '5', 'storybook', 'Platform charge (credits) for placing a print order'),
  ('storybook_pod_markup_percent', '20', 'storybook', 'Markup % added on top of the printer cost in quotes')
on conflict (key) do nothing;
