import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";
import { Container } from "@/components/layout/Container";
import StorybookFlipbook from "@/components/storybook/StorybookFlipbook";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

async function getShared(slug: string) {
  const admin = await getSupabaseAdmin();
  const { data } = await (admin as any)
    .from("storybook_orders")
    .select("id, child_name, story_json, pages, share_slug")
    .eq("share_slug", slug)
    .single();
  return data as {
    id: string;
    child_name: string;
    story_json: { title?: string } | null;
    pages: { pageNumber?: number }[] | null;
    share_slug: string;
  } | null;
}

export async function generateMetadata(
  { params }: { params: { slug: string } },
): Promise<Metadata> {
  const book = await getShared(params.slug);
  if (!book) return { title: "Storybook not found" };
  const title = book.story_json?.title ?? `A story for ${book.child_name}`;
  return {
    title: `${title} — AuditAI Storybooks`,
    description: `Read "${title}", a personalized AI-illustrated storybook made for ${book.child_name}.`,
    openGraph: { title, description: `A personalized storybook for ${book.child_name}` },
  };
}

export default async function SharedStorybookPage(
  { params }: { params: { slug: string } },
) {
  const book = await getShared(params.slug);
  if (!book) notFound();

  return (
    <div className="min-h-screen bg-secondary/40">
      <Container className="py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary">
            <BookOpen className="h-5 w-5 text-primary" /> AuditAI Storybooks
          </Link>
          <Link href="/storybook">
            <Button size="sm" variant="outline">Make your own storybook →</Button>
          </Link>
        </header>

        <StorybookFlipbook
          slug={params.slug}
          title={book.story_json?.title ?? `A story for ${book.child_name}`}
          childName={book.child_name}
        />
      </Container>
    </div>
  );
}
