import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { navSections } from "@/lib/navigation";
import { TOOL_COUNT } from "@/lib/tools/registry";
import { LAB_COUNT } from "@/lib/labs/registry";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span>AuditAI</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              The professional audit platform: {TOOL_COUNT} audit tools, an
              experimental Labs area, and the StoryVerse community publishing
              ecosystem.
            </p>
          </div>
          {navSections.map((section) => (
            <div key={section.id}>
              <p className="text-sm font-semibold text-foreground">
                {section.label}
              </p>
              <ul className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>© {new Date().getFullYear()} AuditAI.</span>
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
          </p>
          <p>Audit results are informational and not a substitute for professional advice.</p>
        </div>
      </div>
    </footer>
  );
}
