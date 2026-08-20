import type { StorySnippet, StoryWork } from "@/lib/types";

/**
 * Backward-compatible empty arrays.
 * Real data is now loaded from Supabase via API routes.
 */
export const STORY_WORKS: StoryWork[] = [];

export const SNIPPETS: StorySnippet[] = [];

export const DISCUSSION_THREADS: {
  id: string;
  title: string;
  author: string;
  replies: number;
  lastActivity: string;
  pinned: boolean;
}[] = [];

export const WALLET_ENTRIES: {
  id: string;
  description: string;
  amount: string;
  date: string;
  kind: string;
}[] = [];
