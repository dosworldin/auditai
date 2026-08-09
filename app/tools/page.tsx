"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Grid3X3, Search } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { Input } from "@/components/ui/Field";
import { TOOL_REGISTRY, categoryLabels } from "@/lib/tools/registry";

export default function ToolsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");

  const filtered = useMemo(() => {
    return TOOL_REGISTRY.filter((tool) => {
      const matchesQuery =
        query.trim() === "" ||
        `${tool.name} ${tool.tagline} ${tool.description}`
          .toLowerCase()
          .includes(query.toLowerCase());
      const matchesCategory =
        category === "All" || tool.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [query, category]);

  return (
    <Container className="py-8">
      <PageHeader
        title="Audit Tools"
        description="A professional catalog of document audit tools. Each tool has a blueprint UI, configuration schema, and report structure ready for future implementation."
        icon={<Grid3X3 className="h-5 w-5" />}
      />

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("All")}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              category === "All"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            All ({TOOL_REGISTRY.length})
          </button>
          {categoryLabels.map((cat) => {
            const count = TOOL_REGISTRY.filter((t) => t.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  category === cat
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search tools..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tools"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center text-sm text-muted-foreground">
          No tools match your search. Try a different keyword or category.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tool) => (
            <Link key={tool.slug} href={`/tools/${tool.slug}`}>
              <Card interactive className="h-full">
                <div className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <ToolIcon icon={tool.icon} accentKey={tool.accent} />
                    <Badge tone="neutral">{tool.category}</Badge>
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">
                    {tool.name}
                  </h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">
                    {tool.tagline}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {tool.pricing.tier} - {tool.pricing.priceUsd === 0 ? "Free" : `$${tool.pricing.priceUsd}/run`}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-primary">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
