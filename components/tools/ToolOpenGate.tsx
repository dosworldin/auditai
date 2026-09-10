"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/context";

/**
 * Open tool gate — the SEO growth lever.
 * Signed-in: render the tool normally.
 * Signed-out: the full tool page still renders (indexable, pre-viewable);
 * only running is gated — a CTA bar sits above the run panel inviting signup.
 */
export function ToolOpenGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  if (!isMounted || loading || user) return <>{children}</>;

  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none select-none opacity-[0.38] blur-[1px]">
        {children}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center pb-10">
        <div className="mx-4 flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 p-6 text-center shadow-2xl backdrop-blur">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> First audit free — no card needed
          </span>
          <h2 className="text-lg font-bold text-foreground">
            Create a free account to run this audit
          </h2>
          <p className="text-sm text-muted-foreground">
            Get your risk score, findings and recommendations in seconds. You also get 100 free
            credits to start.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth?mode=signup">
              <Button>
                Start free <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth">
              <Button variant="outline">Sign in</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
