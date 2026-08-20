import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  LibraryBig,
  MessageSquareText,
  PenLine,
  Store,
  Wallet,
} from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { WorkCard } from "@/components/storyverse/WorkCard";
import { STORY_WORKS } from "@/lib/storyverse/data";

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

export default function StoryVersePage() {
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
            <Link href="/storyverse/create">
              <Badge tone="primary">New story</Badge>
            </Link>
          </>
        }
      />

      <div className="mb-6">
        <BlueprintNote>
          StoryVerse business logic v2 is live: contribution flow, AI Editor
          (continuity + copyright checks), voting, canonization, publication
          review, revenue splits, contributor agreements, and pool inactivity
          management are implemented. Payments, auth, and DB persistence
          remain for future phases.
        </BlueprintNote>
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STORY_WORKS.map((work) => (
          <WorkCard key={work.id} work={work} />
        ))}
      </div>
    </Container>
  );
}
