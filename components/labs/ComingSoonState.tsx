"use client";

import type { LabDefinition } from "@/lib/types";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Clock, Bell } from "lucide-react";
import { useState } from "react";

export function ComingSoonState({ lab }: { lab: LabDefinition }) {
  const [signedUp, setSignedUp] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-foreground">
              Coming Soon
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {lab.name} is currently under development. We&apos;re working hard to bring this
              experimental capability to life. Join the waitlist to be notified
              when it launches.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              {signedUp ? (
                <div className="rounded-xl border border-success/30 bg-success/5 px-5 py-3 text-sm text-foreground animate-fade-in">
                  You&apos;re on the list! We&apos;ll notify you when {lab.name} launches.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSignedUp(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Bell className="h-4 w-4" /> Join the waitlist
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <ToolIcon icon={lab.icon} accentKey={lab.accent} size="lg" />
              <div>
                <h2 className="font-semibold text-foreground">{lab.name}</h2>
                <p className="text-sm text-muted-foreground">{lab.category}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {lab.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="neutral">Coming Soon</Badge>
              <Badge tone="neutral">{lab.category}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="mb-3 text-sm font-medium text-foreground">
              Planned capabilities
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Text input for social situation descriptions
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Location-aware exit script generation
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Context-specific excuses based on venue and group size
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Supported inputs</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lab.inputs.map((input) => (
                <Badge key={input} tone="neutral">
                  {input.toUpperCase()}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Experiments disclaimer</p>
            <p className="mt-2">
              Labs are experimental. Behavior may change or break without
              notice, and results are not guaranteed.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
