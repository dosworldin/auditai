/**
 * Supabase Database TypeScript types.
 * These mirror the schema defined in supabase/schema.sql.
 * In production, run `supabase gen types typescript` to auto-generate.
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          role: "user" | "admin" | "support";
          avatar_url: string | null;
          country: string | null;
          credits: number;
          total_credits_used: number;
          plan: "free" | "starter" | "pro" | "business" | "enterprise";
          is_suspended: boolean;
          suspension_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      admin_settings: {
        Row: { key: string; value: unknown; category: string; description: string | null; updated_by: string | null; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["admin_settings"]["Row"], "updated_at">;
        Update: Partial<Database["public"]["Tables"]["admin_settings"]["Row"]>;
      };
      credit_ledger: {
        Row: { id: string; user_id: string; event_type: string; amount: number; balance_after: number; description: string | null; reference_id: string | null; reference_type: string | null; metadata: Record<string, unknown>; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["credit_ledger"]["Row"], "id" | "created_at">;
        Update: never;
      };
      audit_requests: {
        Row: { id: string; user_id: string; tool_slug: string; tool_name: string; document_name: string | null; input_type: string | null; config: Record<string, unknown>; status: string; error_message: string | null; duration_ms: number | null; used_credits: number; created_at: string; completed_at: string | null };
        Insert: Omit<Database["public"]["Tables"]["audit_requests"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["audit_requests"]["Row"]>;
      };
      audit_reports: {
        Row: { id: string; request_id: string; user_id: string; tool_slug: string; tool_name: string; document_name: string | null; risk_score: number; risk_label: string; summary: string | null; report_data: Record<string, unknown>; findings_count: number; critical_count: number; high_count: number; medium_count: number; low_count: number; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["audit_reports"]["Row"], "id" | "created_at">;
        Update: never;
      };
      lab_requests: {
        Row: { id: string; user_id: string; lab_slug: string; status: string; input_type: string | null; input_text: string | null; config: Record<string, unknown>; output_data: Record<string, unknown> | null; duration_ms: number | null; used_credits: number; created_at: string; completed_at: string | null };
        Insert: Omit<Database["public"]["Tables"]["lab_requests"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["lab_requests"]["Row"]>;
      };
      dream_entries: {
        Row: { id: string; user_id: string; narrative: string; symbols: unknown[]; emotions: unknown[]; themes: unknown[]; objects: unknown[]; entities: unknown[]; locations: unknown[]; actions: unknown[]; ending: string | null; country: string | null; normalized_vector: Record<string, unknown>; follow_up_history: unknown[]; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["dream_entries"]["Row"], "id" | "created_at">;
        Update: never;
      };
      storyverse_stories: {
        Row: { id: string; title: string; description: string; genre: string; language: string; story_type: string; owner_id: string; status: string; current_round: number; total_rounds: number; cover_color: string; invite_required: boolean; origin_country: string | null; tags: string[]; inactivity_state: Record<string, unknown> | null; contributor_agreement_version: string | null; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["storyverse_stories"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["storyverse_stories"]["Row"]>;
      };
      storyverse_contributors: {
        Row: { id: string; story_id: string; user_id: string; display_name: string; country: string | null; role: string; total_contributions: number; canon_wins: number; total_votes_received: number; total_words_accepted: number; joined_at: string };
        Insert: Omit<Database["public"]["Tables"]["storyverse_contributors"]["Row"], "id" | "joined_at">;
        Update: never;
      };
      storyverse_contributions: {
        Row: { id: string; story_id: string; round_id: string; author_id: string; author_display_name: string; author_country: string | null; content: string; word_count: number; status: string; votes: number; is_canon: boolean; ai_polish_status: string; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["storyverse_contributions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["storyverse_contributions"]["Row"]>;
      };
      storyverse_votes: {
        Row: { id: string; contribution_id: string; story_id: string; round_id: string; voter_id: string; vote_type: string; weight: number; token_amount: number | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["storyverse_votes"]["Row"], "id" | "created_at">;
        Update: never;
      };
      storyverse_ledger: {
        Row: { id: string; event_type: string; story_id: string | null; round_id: string | null; chapter_id: string | null; contribution_id: string | null; user_id: string | null; metadata: Record<string, unknown>; timestamp: string; immutable: boolean };
        Insert: Omit<Database["public"]["Tables"]["storyverse_ledger"]["Row"], "id" | "timestamp">;
        Update: never;
      };
      storyverse_wallets: {
        Row: { user_id: string; total_earned: number; pending_balance: number; available_balance: number; total_payouts: number; updated_at: string };
        Insert: Database["public"]["Tables"]["storyverse_wallets"]["Row"];
        Update: Partial<Database["public"]["Tables"]["storyverse_wallets"]["Row"]>;
      };
      storyverse_library: {
        Row: { id: string; user_id: string; story_id: string; access_type: string; added_at: string; last_read_chapter: number | null };
        Insert: Omit<Database["public"]["Tables"]["storyverse_library"]["Row"], "id" | "added_at">;
        Update: never;
      };
      support_tickets: {
        Row: { id: string; user_id: string; category: string; subject: string; message: string; status: string; priority: string; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["support_tickets"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["support_tickets"]["Row"]>;
      };
      support_replies: {
        Row: { id: string; ticket_id: string; user_id: string; message: string; is_internal_note: boolean; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["support_replies"]["Row"], "id" | "created_at">;
        Update: never;
      };
    };
  };
}
