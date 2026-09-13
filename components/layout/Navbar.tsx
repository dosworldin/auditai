"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  User,
  Wallet,
  X,
} from "lucide-react";
import { mainNavLinks, navSections } from "@/lib/navigation";
import { ThemeToggle } from "@/lib/theme/theme-engine";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/context";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut } = useAuth();

  // Close the user dropdown when clicking outside of it.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const displayName = profile?.display_name || user?.email || "";
  const initial = (displayName[0] ?? "?").toUpperCase();
  const isAdmin = profile?.role === "admin";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">AuditAI</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {mainNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            /* User dropdown — visible on every device (mobile, tablet, laptop) */
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-foreground transition-colors hover:bg-secondary"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initial}
                </span>
                <span className="hidden max-w-[120px] truncate text-xs font-medium sm:block">
                  {displayName}
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", menuOpen && "rotate-180")} />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card py-2 shadow-lg animate-fade-in"
                >
                  <div className="border-b border-border px-4 pb-2 pt-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {profile?.display_name || "Account"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>

                  <div className="py-1">
                    <MenuLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      Dashboard
                    </MenuLink>
                    <MenuLink href="/wallet" icon={<Wallet className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      Wallet
                    </MenuLink>
                    <MenuLink href="/account" icon={<User className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      Account
                    </MenuLink>
                    <MenuLink href="/account/security" icon={<KeyRound className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      Security
                    </MenuLink>
                    {isAdmin ? (
                      <MenuLink
                        href="/admin"
                        icon={<ShieldCheck className="h-4 w-4" />}
                        highlight
                        onClick={() => setMenuOpen(false)}
                      >
                        Admin Dashboard
                      </MenuLink>
                    ) : null}
                  </div>

                  <div className="border-t border-border pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <Link href="/auth">
                <Button variant="outline" size="sm">Sign in</Button>
              </Link>
              <Link href="/auth?mode=signup">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-border bg-card px-4 py-4 lg:hidden animate-fade-in">
          <div className="grid gap-1">
            {mainNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
          {isAdmin ? (
            <div className="mt-3">
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
              >
                <ShieldCheck className="h-4 w-4" /> Admin Dashboard
              </Link>
            </div>
          ) : null}
          <div className="mt-4 space-y-4">
            {navSections.map((section) => (
              <div key={section.id}>
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </p>
                <div className="grid gap-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
  highlight,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
        highlight
          ? "font-medium text-primary hover:bg-primary/10"
          : "text-foreground hover:bg-secondary",
      )}
    >
      {icon} {children}
    </Link>
  );
}
