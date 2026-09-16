-- Dream AI Analyzer — production upgrade migration
-- Adds: stable anonymous match identity, AI analysis persistence,
-- concrete match details, and a retry/duplicate guard (content hash).
--
-- Idempotent: safe to run once against production
-- (Supabase SQL editor or `supabase db push`).

alter table public.dream_entries
  add column if not exists match_alias text;

alter table public.dream_entries
  add column if not exists match_country text;

alter table public.dream_entries
  add column if not exists match_identity_generated_at timestamptz;

alter table public.dream_entries
  add column if not exists ai_analysis jsonb;

alter table public.dream_matches
  add column if not exists matches_detail jsonb default '[]';

-- Content-hash duplicate guard (reads normalized_vector->>contentHash).
create index if not exists dream_entries_content_hash_idx
  on public.dream_entries ((normalized_vector->>'contentHash'));
