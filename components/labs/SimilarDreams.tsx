"use client";

import { Globe, Sparkles, AlertCircle, Users } from "lucide-react";
import type { SimilarDreamInfo, SimilarDreamMatchDetail } from "@/lib/engine/types";
import { Badge } from "@/components/ui/Badge";

interface SimilarDreamsProps {
  data: SimilarDreamInfo;
  matchDetails?: SimilarDreamMatchDetail[];
}

export function SimilarDreams({ data, matchDetails }: SimilarDreamsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Similar Dreams
        </h3>
        <Badge tone={data.isReal ? "success" : "warning"}>
          {data.isReal ? "Real Database Match" : "Example / Sample"}
        </Badge>
      </div>

      {data.identity ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Your anonymous dream identity:{" "}
          <span className="font-medium text-foreground">{data.identity.alias}</span>
          {data.identity.country && data.identity.country !== "Unknown" ? (
            <> · {data.identity.country}</>
          ) : null}
        </p>
      ) : null}

      {!data.isReal && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span>
            {data.exampleDescription ??
              "No real matches found. This is the first recorded dream of its kind — a random comparison identity has been registered for it."}
          </span>
        </div>
      )}

      {data.isReal && data.aggregateOnly ? (
        /* More than 5 matches — show count/aggregate only (spec: no detail dump) */
        <div className="mt-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {data.totalCount} people have reported a similar dream
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Location breakdown is aggregated to protect privacy.
              </p>
            </div>
          </div>

          {data.locations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.locations.map((loc) => (
                <div
                  key={loc.country}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs"
                >
                  <span className="font-medium text-foreground">
                    {loc.country}
                  </span>
                  <span className="text-muted-foreground">
                    · {loc.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 0-5 matches — show individual breakdown */
        <div className="mt-4">
          {data.totalCount === 0 ? (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No similar dreams found in the database yet.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">
                {data.totalCount === 1
                  ? "1 person reported a similar dream"
                  : `${data.totalCount} people reported a similar dream`}
              </p>

              {matchDetails && matchDetails.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {matchDetails.map((m, i) => (
                    <div
                      key={`${m.alias}-${i}`}
                      className="rounded-lg border border-border bg-muted/30 px-4 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {m.alias}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {m.country}
                          {m.country ? " · " : ""}
                          {Math.round(m.similarity * 100)}% similar
                        </span>
                      </div>
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        &ldquo;{m.narrativeExcerpt}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                data.locations.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {data.locations.map((loc) => (
                      <div
                        key={loc.country}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5"
                      >
                        <span className="text-sm font-medium text-foreground">
                          {loc.country}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {loc.count === 1 ? "1 person" : `${loc.count} people`}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            {data.isReal
              ? "Only anonymous aliases and country-level information are shown. No personal details are ever exposed."
              : "Example data is clearly distinguished from real database matches."}
          </p>
        </div>
      )}
    </div>
  );
}
