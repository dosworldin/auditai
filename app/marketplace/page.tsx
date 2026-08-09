"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Package, Store } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { cn } from "@/lib/utils";

interface Listing {
  slug: string;
  name: string;
  description: string;
  type: "Extension" | "Template Pack" | "Integration";
  price: string;
  rating: string;
  downloads: number;
  icon: "file" | "sparkles" | "plug";
}

const LISTINGS: Listing[] = [
  {
    slug: "contract-clause-library",
    name: "Contract Clause Library",
    description: "A curated library of 500+ standard and high-risk clauses for faster contract audits.",
    type: "Template Pack",
    price: "$19.99",
    rating: "4.7",
    downloads: 2140,
    icon: "file",
  },
  {
    slug: "gst-rule-pack",
    name: "GST Rule Pack",
    description: "Updated GST/HSN lookup and validation rules for the GST invoice checker.",
    type: "Extension",
    price: "$9.99",
    rating: "4.5",
    downloads: 980,
    icon: "sparkles",
  },
  {
    slug: "email-notification-hook",
    name: "Email Notification Hook",
    description: "Deliver audit completion notifications to your inbox or team channel.",
    type: "Integration",
    price: "Free",
    rating: "4.9",
    downloads: 3120,
    icon: "plug",
  },
  {
    slug: "storyverse-canon-kit",
    name: "StoryVerse Canon Kit",
    description: "Templates and genre packs for running structured StoryVerse campaigns.",
    type: "Template Pack",
    price: "$14.99",
    rating: "4.6",
    downloads: 740,
    icon: "sparkles",
  },
];

export default function MarketplacePage() {
  const [filter, setFilter] = useState("All");

  const filtered = LISTINGS.filter(
    (l) => filter === "All" || l.type === filter,
  );

  return (
    <Container className="py-8">
      <PageHeader
        title="Marketplace"
        description="Extensions, template packs and integrations that enhance the AuditAI platform."
        icon={<Store className="h-5 w-5" />}
      />

      <div className="mb-6">
        <Badge tone="info">
          Marketplace listings are blueprint placeholders. Commerce is a future phase.
        </Badge>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {["All", "Extension", "Template Pack", "Integration"].map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setFilter(label)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === label
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((listing) => (
          <Link key={listing.slug} href={`/marketplace/${listing.slug}`}>
            <Card interactive className="h-full">
              <div className="flex h-full gap-4 p-5">
                <ToolIcon
                  icon={
                    listing.icon === "file" ? Package : listing.icon === "plug" ? ArrowRight : Package
                  }
                  accentKey={
                    listing.type === "Extension"
                      ? "violet"
                      : listing.type === "Template Pack"
                        ? "indigo"
                        : "teal"
                  }
                  size="lg"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground">
                      {listing.name}
                    </h3>
                    <Badge tone="neutral">{listing.type}</Badge>
                  </div>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">
                    {listing.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">
                      {listing.price}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {listing.rating} - {listing.downloads.toLocaleString()} installs
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
