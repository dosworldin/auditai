import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  FlaskConical,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { TOOL_REGISTRY, categoryLabels } from "@/lib/tools/registry";
import { LAB_COUNT } from "@/lib/labs/registry";

const platformPillars = [
  {
    title: "Audit Tools",
    description:
      "A growing catalog of professional audit tools covering legal, finance, tax, privacy, security, health, research, and more.",
    href: "/tools",
    icon: ShieldCheck,
    accent: "indigo" as const,
  },
  {
    title: "Labs",
    description:
      "An experimental playground for next-generation AI capabilities before they graduate into stable tools.",
    href: "/labs",
    icon: FlaskConical,
    accent: "violet" as const,
  },
  {
    title: "StoryVerse",
    description:
      "A collaborative community publishing platform where stories are written, voted on, canonized and published together.",
    href: "/storyverse",
    icon: BookOpenText,
    accent: "teal" as const,
  },
];

const featuredTools = [
  "contract-watchdog",
  "insurance-trap-detector",
  "privacy-policy-auditor",
  "bank-statement-analyzer",
  "ai-content-detector",
  "scam-detector",
];

export default function LandingPage() {
  const featured = TOOL_REGISTRY.filter((t) => featuredTools.includes(t.slug));

  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-accent/40 via-background to-background">
        <Container className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge tone="primary" className="mb-4">
              <Sparkles className="h-3.5 w-3.5" /> Professional document audits for everyone
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
              Understand every document
              <span className="text-primary"> before you sign.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              AuditAI turns contracts, invoices, policies, reports and notices
              into plain-English audits - so you know exactly what you are
              agreeing to, paying, or accepting.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/tools">
                <Button size="lg">
                  Explore 40+ audit tools <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline">
                  View pricing
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Free tools for everyday audits - no credit card required
            </p>
          </div>
        </Container>
      </section>

      <Container className="py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {platformPillars.map((pillar) => (
            <Link key={pillar.title} href={pillar.href} className="group">
              <Card interactive className="h-full">
                <div className="p-6">
                  <ToolIcon
                    icon={pillar.icon}
                    accentKey={pillar.accent}
                    size="lg"
                  />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {pillar.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Explore{" "}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Container>

      <Container className="py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Popular audit tools
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {TOOL_REGISTRY.length} tools across {categoryLabels.length}{" "}
              categories
            </p>
          </div>
          <Link href="/tools">
            <Button variant="outline">
              Browse all tools <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((tool) => (
            <Link key={tool.slug} href={`/tools/${tool.slug}`}>
              <Card interactive className="h-full">
                <div className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between">
                    <ToolIcon icon={tool.icon} accentKey={tool.accent} />
                    <Badge tone="neutral">{tool.category}</Badge>
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">
                    {tool.name}
                  </h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">
                    {tool.tagline}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{tool.pricing.tier}</span>
                    <span className="inline-flex items-center gap-1 text-primary">
                      Open tool <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Container>

      <section className="border-y border-border bg-card">
        <Container className="py-14">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Badge tone="primary">StoryVerse</Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                Write stories together. Publish with the community.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Create a story, invite co-authors to contribute sentences and
                scenes, vote on the best contributions, and watch the story
                grow through rounds and chapters - with AI keeping continuity
                and safety in check.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/storyverse">
                  <Button>
                    Enter StoryVerse <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/storyverse/marketplace">
                  <Button variant="outline">
                    <Wallet className="h-4 w-4" /> Browse the marketplace
                  </Button>
                </Link>
              </div>
            </div>
            <div className="grid gap-3">
              {[
                { step: "1", text: "Create a story and set its canon rules" },
                { step: "2", text: "Co-authors contribute snippets, AI checks continuity" },
                { step: "3", text: "Community votes - winning contributions become canon" },
                { step: "4", text: "Completed stories enter publication review" },
                { step: "5", text: "Publish to the marketplace and earn attribution" },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-4"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {item.step}
                  </span>
                  <p className="text-sm text-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge tone="primary">
              <FlaskConical className="h-3.5 w-3.5" /> Labs
            </Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
              Experimental AI, before it goes mainstream
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {LAB_COUNT} experiments across document intelligence, research,
              security, compliance, forensics, and future AI.
            </p>
          </div>
          <Link href="/labs">
            <Button variant="outline">
              Visit Labs <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="mt-6">
          <BlueprintNote>
            This is Blueprint Phase 1. Tool UIs, routes and module structures
            are production-ready, while business logic, scoring, AI prompts,
            and payments are intentionally deferred to future phases.
          </BlueprintNote>
        </div>
      </Container>
    </>
  );
}
