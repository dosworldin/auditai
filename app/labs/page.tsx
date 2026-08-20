import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { labCategories, getLabsByCategory, LAB_COUNT } from "@/lib/labs/registry";

const statusBadge: Record<string, "info" | "warning" | "success" | "neutral"> = {
  Experimental: "warning",
  Beta: "info",
  Ready: "success",
  "Coming Soon": "neutral",
};

export default function LabsPage() {
  const grouped = getLabsByCategory();

  return (
    <Container className="py-8">
      <PageHeader
        title="Labs"
        description="An experimental playground for next-generation AI capabilities. Labs range from Experimental (rough edges) to Ready (fully functional)."
        icon={<FlaskConical className="h-5 w-5" />}
      />

      <div className="space-y-10">
        {labCategories.map((category) => {
          const labs = grouped[category.id];
          if (!labs || labs.length === 0) return null;
          return (
            <section key={category.id}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {category.id}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {category.description}
                  </p>
                </div>
                <Badge tone="neutral">
                  {labs.length} {labs.length === 1 ? "module" : "modules"}
                </Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {labs.map((lab) => (
                  <Link key={lab.slug} href={`/labs/${lab.slug}`}>
                    <Card interactive className="h-full">
                      <div className="flex h-full flex-col p-5">
                        <div className="flex items-start justify-between gap-2">
                          <ToolIcon icon={lab.icon} accentKey={lab.accent} />
                          <Badge tone={statusBadge[lab.status] ?? "neutral"}>
                            {lab.status}
                          </Badge>
                        </div>
                        <h3 className="mt-4 font-semibold text-foreground">
                          {lab.name}
                        </h3>
                        <p className="mt-1 flex-1 text-sm text-muted-foreground">
                          {lab.description}
                        </p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {lab.inputs.map((i) => i.toUpperCase()).join(", ")}
                          </span>
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                            {lab.comingSoon ? "Coming Soon" : "Open"}{" "}
                            {!lab.comingSoon && <ArrowRight className="h-3.5 w-3.5" />}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        {LAB_COUNT} experiment modules currently defined across{" "}
        {labCategories.length} categories.
      </p>
    </Container>
  );
}
