-- ============================================================================
-- AuditAI Platform — Supabase Database Schema
-- ============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. AUTH & USER PROFILES
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin', 'support')),
  avatar_url text,
  country text,
  credits numeric(12,2) not null default 100.00,
  total_credits_used numeric(12,2) not null default 0,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'business', 'enterprise')),
  is_suspended boolean not null default false,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 2. ADMIN SETTINGS (Runtime Configuration)
-- ============================================================================

create table public.admin_settings (
  key text primary key,
  value jsonb not null,
  category text not null default 'general',
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;

create policy "Anyone can read settings"
  on public.admin_settings for select
  using (true);

create policy "Only admins can modify settings"
  on public.admin_settings for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Seed default settings
insert into public.admin_settings (key, value, category, description) values
  ('platform_name', '"AuditAI"', 'general', 'Platform display name'),
  ('maintenance_mode', 'false', 'general', 'Enable maintenance mode'),
  ('ai_primary_provider', '"deepseek"', 'ai', 'Primary AI provider'),
  ('ai_fallback_provider', '"gemini"', 'ai', 'Fallback AI provider'),
  ('ocr_provider', '"tesseract"', 'ocr', 'OCR provider'),
  ('credit_value', '0.10', 'billing', 'Dollar value per credit'),
  ('tool_pricing_enabled', 'false', 'billing', 'Enable per-tool pricing'),
  ('promotion_enabled', 'true', 'promotion', 'Enable free-tier promotions'),
  ('promotion_uses_per_tool', '1', 'promotion', 'Free uses per tool during promotion'),
  ('storyverse_book_platform_percent', '30', 'storyverse', 'Platform share of book sales'),
  ('storyverse_book_author_percent', '70', 'storyverse', 'Author pool share of book sales'),
  ('storyverse_vote_platform_percent', '70', 'storyverse', 'Platform share of paid voting'),
  ('storyverse_vote_author_percent', '30', 'storyverse', 'Author pool share of paid voting'),
  ('storyverse_ai_editor_price', '10', 'storyverse', 'AI Editor credit cost'),
  ('storyverse_private_invite_price', '0', 'storyverse', 'Private invitation price'),
  ('storyverse_pool_inactivity_hold_days', '7', 'storyverse', 'Pool inactivity hold days'),
  ('storyverse_archive_days', '365', 'storyverse', 'Archive period days'),
  ('storyverse_retention_days', '365', 'storyverse', 'Retention period days'),
  ('storyverse_min_payout', '10', 'storyverse', 'Minimum payout threshold'),
  ('storyverse_scoring_canon_wins', '40', 'storyverse', 'Scoring weight: canon wins'),
  ('storyverse_scoring_words', '30', 'storyverse', 'Scoring weight: published words'),
  ('storyverse_scoring_votes', '20', 'storyverse', 'Scoring weight: vote score'),
  ('storyverse_scoring_participation', '10', 'storyverse', 'Scoring weight: participation')
on conflict (key) do nothing;

-- ============================================================================
-- 3. CREDITS & BILLING LEDGER
-- ============================================================================

create table public.credit_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in (
    'signup_bonus', 'purchase', 'tool_use', 'lab_use', 'ai_editor_charge',
    'invitation_charge', 'token_purchase', 'refund', 'admin_adjustment',
    'promotion_use', 'storyverse_charge'
  )),
  amount numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  description text,
  reference_id text,
  reference_type text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;

create policy "Users can read own credit ledger"
  on public.credit_ledger for select
  using (auth.uid() = user_id);

create policy "Admins can read all credit ledgers"
  on public.credit_ledger for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================================
-- 4. AUDIT TOOLS — Requests, Reports, Findings
-- ============================================================================

create table public.audit_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_slug text not null,
  tool_name text not null,
  document_name text,
  input_type text,
  config jsonb default '{}',
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  )),
  error_message text,
  duration_ms integer,
  used_credits numeric(8,2) default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.audit_requests enable row level security;

create policy "Users can read own requests"
  on public.audit_requests for select
  using (auth.uid() = user_id);

create policy "Users can insert own requests"
  on public.audit_requests for insert
  with check (auth.uid() = user_id);

create policy "Users can update own requests"
  on public.audit_requests for update
  using (auth.uid() = user_id);

create policy "Admins can read all requests"
  on public.audit_requests for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create index idx_audit_requests_user on public.audit_requests(user_id, created_at desc);
create index idx_audit_requests_status on public.audit_requests(status);

create table public.audit_reports (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references public.audit_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_slug text not null,
  tool_name text not null,
  document_name text,
  risk_score integer default 0,
  risk_label text default 'Low',
  summary text,
  report_data jsonb not null,
  findings_count integer default 0,
  critical_count integer default 0,
  high_count integer default 0,
  medium_count integer default 0,
  low_count integer default 0,
  created_at timestamptz not null default now()
);

alter table public.audit_reports enable row level security;

create policy "Users can read own reports"
  on public.audit_reports for select
  using (auth.uid() = user_id);

create policy "Users can insert own reports"
  on public.audit_reports for insert
  with check (auth.uid() = user_id);

create policy "Admins can read all reports"
  on public.audit_reports for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create index idx_audit_reports_user on public.audit_reports(user_id, created_at desc);
create index idx_audit_reports_tool on public.audit_reports(tool_slug, created_at desc);

-- ============================================================================
-- 5. LABS — Dream, Kalesh, Passive Aggressive
-- ============================================================================

create table public.lab_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lab_slug text not null,
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'completed', 'failed'
  )),
  input_type text,
  input_text text,
  config jsonb default '{}',
  output_data jsonb,
  duration_ms integer,
  used_credits numeric(8,2) default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.lab_requests enable row level security;

create policy "Users can read own lab requests"
  on public.lab_requests for select
  using (auth.uid() = user_id);

create policy "Users can insert own lab requests"
  on public.lab_requests for insert
  with check (auth.uid() = user_id);

create table public.dream_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  narrative text not null,
  symbols jsonb default '[]',
  emotions jsonb default '[]',
  themes jsonb default '[]',
  objects jsonb default '[]',
  entities jsonb default '[]',
  locations jsonb default '[]',
  actions jsonb default '[]',
  ending text,
  country text,
  normalized_vector jsonb default '{}',
  follow_up_history jsonb default '[]',
  created_at timestamptz not null default now()
);

alter table public.dream_entries enable row level security;

create policy "Users can read own dreams"
  on public.dream_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own dreams"
  on public.dream_entries for insert
  with check (auth.uid() = user_id);

create table public.dream_matches (
  id uuid primary key default uuid_generate_v4(),
  dream_entry_id uuid not null references public.dream_entries(id) on delete cascade,
  is_real boolean not null default false,
  total_count integer default 0,
  locations jsonb default '[]',
  aggregate_only boolean default false,
  example_description text,
  created_at timestamptz not null default now()
);

alter table public.dream_matches enable row level security;

create policy "Users can read own dream matches"
  on public.dream_matches for select
  using (
    exists (
      select 1 from public.dream_entries
      where id = dream_entry_id and user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. STORYVERSE
-- ============================================================================

create table public.storyverse_stories (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null,
  genre text not null,
  language text not null default 'English',
  story_type text not null check (story_type in ('pool_open', 'pool_private', 'solo_open', 'solo_ai')),
  owner_id uuid not null references public.profiles(id),
  status text not null default 'DRAFT',
  current_round integer default 0,
  total_rounds integer default 0,
  cover_color text default 'indigo',
  invite_required boolean default false,
  origin_country text,
  tags text[] default '{}',
  inactivity_state jsonb,
  contributor_agreement_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.storyverse_stories enable row level security;

create policy "Anyone can read published stories"
  on public.storyverse_stories for select
  using (status in ('PUBLISHED', 'MARKETPLACE'));

create policy "Owners can manage own stories"
  on public.storyverse_stories for all
  using (auth.uid() = owner_id);

create policy "Contributors can read stories they contribute to"
  on public.storyverse_stories for select
  using (
    exists (
      select 1 from public.storyverse_contributors
      where story_id = id and user_id = auth.uid()
    )
  );

create table public.storyverse_contributors (
  id uuid primary key default uuid_generate_v4(),
  story_id uuid not null references public.storyverse_stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  display_name text not null,
  country text,
  role text not null default 'contributor' check (role in ('owner', 'co_author', 'contributor', 'ai_assistant')),
  total_contributions integer default 0,
  canon_wins integer default 0,
  total_votes_received integer default 0,
  total_words_accepted integer default 0,
  joined_at timestamptz not null default now(),
  unique(story_id, user_id)
);

alter table public.storyverse_contributors enable row level security;

create table public.storyverse_chapters (
  id uuid primary key default uuid_generate_v4(),
  story_id uuid not null references public.storyverse_stories(id) on delete cascade,
  number integer not null,
  title text not null,
  content text not null default '',
  word_count integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.storyverse_chapters enable row level security;

create table public.storyverse_rounds (
  id uuid primary key default uuid_generate_v4(),
  story_id uuid not null references public.storyverse_stories(id) on delete cascade,
  round_number integer not null,
  status text not null default 'OPEN',
  chapter_id uuid references public.storyverse_chapters(id),
  canon_contribution_id uuid,
  voting_started_at timestamptz,
  voting_ends_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.storyverse_rounds enable row level security;

create table public.storyverse_contributions (
  id uuid primary key default uuid_generate_v4(),
  story_id uuid not null references public.storyverse_stories(id) on delete cascade,
  round_id uuid not null references public.storyverse_rounds(id),
  author_id uuid not null references public.profiles(id),
  author_display_name text not null,
  author_country text,
  content text not null,
  word_count integer default 0,
  status text not null default 'PENDING',
  votes integer default 0,
  is_canon boolean default false,
  ai_polish_status text default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.storyverse_contributions enable row level security;

create table public.storyverse_votes (
  id uuid primary key default uuid_generate_v4(),
  contribution_id uuid not null references public.storyverse_contributions(id) on delete cascade,
  story_id uuid not null references public.storyverse_stories(id),
  round_id uuid not null references public.storyverse_rounds(id),
  voter_id uuid not null references public.profiles(id),
  vote_type text not null default 'free' check (vote_type in ('free', 'paid')),
  weight integer default 1,
  token_amount integer,
  created_at timestamptz not null default now(),
  unique(contribution_id, voter_id)
);

alter table public.storyverse_votes enable row level security;

create table public.storyverse_ledger (
  id uuid primary key default uuid_generate_v4(),
  event_type text not null,
  story_id uuid,
  round_id uuid,
  chapter_id uuid,
  contribution_id uuid,
  user_id uuid,
  metadata jsonb default '{}',
  timestamp timestamptz not null default now(),
  immutable boolean default true
);

alter table public.storyverse_ledger enable row level security;

create policy "Story participants can read story ledger"
  on public.storyverse_ledger for select
  using (
    exists (
      select 1 from public.storyverse_contributors
      where story_id = storyverse_ledger.story_id and user_id = auth.uid()
    )
  );

create table public.storyverse_revenue (
  id uuid primary key default uuid_generate_v4(),
  story_id uuid not null references public.storyverse_stories(id),
  revenue_type text not null check (revenue_type in ('book_sale', 'paid_vote_sale')),
  gross_amount numeric(12,2) not null,
  platform_amount numeric(12,2) not null,
  author_pool_amount numeric(12,2) not null,
  distribution jsonb default '[]',
  currency text default 'USD',
  ledger_entry_id uuid,
  created_at timestamptz not null default now(),
  immutable boolean default true
);

alter table public.storyverse_revenue enable row level security;

create table public.storyverse_wallets (
  user_id uuid primary key references public.profiles(id),
  total_earned numeric(12,2) default 0,
  pending_balance numeric(12,2) default 0,
  available_balance numeric(12,2) default 0,
  total_payouts numeric(12,2) default 0,
  updated_at timestamptz not null default now()
);

alter table public.storyverse_wallets enable row level security;

create policy "Users can read own wallet"
  on public.storyverse_wallets for select
  using (auth.uid() = user_id);

create table public.storyverse_payouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null,
  currency text default 'USD',
  method text not null check (method in ('upi', 'bank', 'paypal')),
  status text not null default 'pending',
  account_identifier text not null,
  kyc_verified boolean default false,
  security_cleared boolean default false,
  ledger_entry_id uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  rejection_reason text
);

alter table public.storyverse_payouts enable row level security;

create policy "Users can read own payouts"
  on public.storyverse_payouts for select
  using (auth.uid() = user_id);

create table public.storyverse_library (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  story_id uuid not null references public.storyverse_stories(id),
  access_type text not null default 'purchased',
  added_at timestamptz not null default now(),
  last_read_chapter integer,
  unique(user_id, story_id)
);

alter table public.storyverse_library enable row level security;

create policy "Users can read own library"
  on public.storyverse_library for select
  using (auth.uid() = user_id);

create table public.storyverse_invitations (
  id uuid primary key default uuid_generate_v4(),
  story_id uuid not null references public.storyverse_stories(id),
  inviter_id uuid not null references public.profiles(id),
  invitee_id uuid not null references public.profiles(id),
  status text not null default 'pending',
  expires_at timestamptz not null,
  invite_price numeric(8,2) default 0,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.storyverse_invitations enable row level security;

create table public.storyverse_contributor_agreements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  agreement_version text not null,
  agreement_text_hash text not null,
  accepted boolean default true,
  accepted_at timestamptz not null default now()
);

alter table public.storyverse_contributor_agreements enable row level security;

create policy "Users can read own agreements"
  on public.storyverse_contributor_agreements for select
  using (auth.uid() = user_id);

create table public.storyverse_ai_editor_requests (
  id uuid primary key default uuid_generate_v4(),
  story_id uuid not null references public.storyverse_stories(id),
  contribution_id uuid not null references public.storyverse_contributions(id),
  round_id uuid,
  author_id uuid not null references public.profiles(id),
  original_content text not null,
  continuity_result jsonb,
  copyright_result jsonb,
  suggested_rewrite text,
  approved_content text,
  status text not null default 'pending',
  credits_cost integer default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.storyverse_ai_editor_requests enable row level security;

create table public.storyverse_abuse_flags (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  story_id uuid,
  flag_type text not null,
  details text,
  detected_at timestamptz not null default now(),
  resolved boolean default false,
  resolution text
);

alter table public.storyverse_abuse_flags enable row level security;

-- ============================================================================
-- 7. SUPPORT TICKETS
-- ============================================================================

create table public.support_tickets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  category text not null default 'general',
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

create policy "Users can read own tickets"
  on public.support_tickets for select
  using (auth.uid() = user_id);

create policy "Users can create tickets"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

create policy "Admins can read all tickets"
  on public.support_tickets for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create table public.support_replies (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  message text not null,
  is_internal_note boolean default false,
  created_at timestamptz not null default now()
);

alter table public.support_replies enable row level security;

create policy "Users can read own ticket replies"
  on public.support_replies for select
  using (
    exists (
      select 1 from public.support_tickets
      where id = ticket_id and user_id = auth.uid()
    )
  );

create policy "Users can reply to own tickets"
  on public.support_replies for insert
  with check (
    exists (
      select 1 from public.support_tickets
      where id = ticket_id and user_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================================

create index idx_storyverse_stories_owner on public.storyverse_stories(owner_id);
create index idx_storyverse_stories_status on public.storyverse_stories(status);
create index idx_storyverse_contributors_story on public.storyverse_contributors(story_id);
create index idx_storyverse_contributors_user on public.storyverse_contributors(user_id);
create index idx_storyverse_contributions_round on public.storyverse_contributions(round_id);
create index idx_storyverse_contributions_author on public.storyverse_contributions(author_id);
create index idx_storyverse_votes_round on public.storyverse_votes(round_id);
create index idx_storyverse_ledger_story on public.storyverse_ledger(story_id, timestamp);
create index idx_storyverse_revenue_story on public.storyverse_revenue(story_id);
create index idx_credit_ledger_user on public.credit_ledger(user_id, created_at desc);
create index idx_dream_entries_user on public.dream_entries(user_id);
create index idx_support_tickets_status on public.support_tickets(status);
