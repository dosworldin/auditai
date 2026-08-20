"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  LibraryBig,
  Loader2,
  MessageSquareText,
  PenLine,
  Store,
  Wallet,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { WorkCard } from "@/components/storyverse/WorkCard";
import { useAuth } from "@/lib/auth/context";
import { getSupabaseBrowser } from "@/lib/db/supabase-browser";

const storyVerseLinks = [
  { label: "Create a story", href: "/storyverse/create", icon: PenLine, accent: "indigo" as const },
  { label: "Marketplace", href: "/storyverse/marketplace", icon: Store, accent: "teal" as const },
  { label: "Your library", href: "/storyverse/library", icon: LibraryBig, accent: "violet" as const },
  { label: "Author wallet", href: "/storyverse/wallet", icon: Wallet, accent: "emerald" as const },
  { label: "Discussions", href: "/storyverse/support/discussion", icon: MessageSquareText, accent: "amber" as const },
];

const flow = [
  { step: "Create", text: "Start a story with a title, premise, and canon rules." },
  { step: "Contribute", text: "Co-authors add sentence- and snippet-level content." },
  { step: "AI Check", text: "AI validates continuity, safety and consistency." },
  { step: "Vote", text: "The community votes on contributions. Winners become canon." },
  { step: "Publish", text: "Completed stories enter review, then the Marketplace." },
];

import type { StoryWork } from "@/lib/types";

export default function StoryVersePage() {
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryWork[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStories() {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase
          .from("storyverse_stories")
          .select("id, title, description, genre, status, cover_color, story_type, owner_id, current_round, total_rounds")
          .in("status", ["ACTIVE", "ROUND_VOTING", "PUBLICATION_REVIEW", "MARKETPLACE", "PUBLISHED"])
          .order("updated_at", { ascending: false })
          .limit(9);

        if (data) {
          const works: StoryWork[] = (data as unknown as Array<{
            id: string; title: string; description: string; genre: string;
            status: string; cover_color: string; owner_id: string;
            current_round: number; total_rounds: number;
          }>).map((s) => ({
            id: s.id,
            title: s.title,
            synopsis: s.description,
            genre: s.genre,
            author: "",
            contributors: 0,
            rounds: s.current_round,
            status: s.status === "PUBLISHED" || s.status === "MARKETPLACE" ? "Published"
              : s.status === "PUBLICATION_REVIEW" ? "In Review"
              : "In Progress",
            coverColor: s.cover_color,
            chapters: 0,
            progress: s.total_rounds > 0 ? Math.round((s.current_round / s.total_rounds) * 100) : 0,
          }));
          setStories(works);
        }
      } catch {
        // Fallback: use empty list
      } finally {
        setLoading(false);
      }
    }
    loadStories();
  }, []);

  return (
    <Container className="py-8">
      <PageHeader
        title="StoryVerse"
        description="AuditAI's collaborative community publishing platform. Write together, vote on canon, and publish with attribution."
        icon={<BookOpenText className="h-5 w-5" />}
        actions={
          <>
            <Link href="/storyverse/library">
              <Badge tone="info">Library</Badge>
            </Link>
            {user && (
              <Link href="/storyverse/create">
                <Badge tone="primary">New story</Badge>
              </Link>
            )}
          </>
        }
      />

      <section className="mb-10 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            How it works
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {flow.map((item, i) => (
              <div
                key={item.step}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="font-semibold text-foreground">{item.step}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-border bg-card p-4">
              <p className="font-semibold text-foreground">Earn</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Authors receive attribution and revenue shares per the
                platform's contribution rules.
              </p>
              <Link
                href="/storyverse/wallet"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Wallet <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          {storyVerseLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-ring/60 hover:bg-secondary/50">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <link.icon className="h-4 w-4 text-muted-foreground" />
                  {link.label}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Active stories
          </h2>
          <p className="text-sm text-muted-foreground">
            Community-driven works in progress and recently published
          </p>
        </div>
        <Link href="/storyverse/marketplace" className="text-sm font-medium text-primary hover:underline">
          Marketplace
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading stories...</span>
        </div>
      ) : stories.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No stories yet. Be the first to create one!</p>
          {user && (
            <Link href="/storyverse/create" className="mt-3 inline-block">
              <Badge tone="primary">Create a story</Badge>
            </Link>
          )}
        </div>
      )}
    </Container>
  );
}
