"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, User, UserCog } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/context";

const COMMON_COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Brazil",
  "Japan",
  "Singapore",
  "United Arab Emirates",
  "Other",
];

export default function AccountPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Initialize from profile
  const displayName = name || profile?.display_name || "";
  const currentCountry = country || profile?.country || "";
  const email = profile?.email || user?.email || "";

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName, country: currentCountry }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save profile");
      }
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title="Account"
          description="Manage your profile and preferences."
          icon={<User className="h-5 w-5" />}
          actions={
            <Button variant="ghost" onClick={() => signOut()}>
              Sign out
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader
                title="Profile"
                subtitle="Basic account information"
                icon={<UserCog className="h-4 w-4" />}
              />
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-accent-foreground">
                    {displayName.charAt(0).toUpperCase() || email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{displayName || "New user"}</p>
                    <p className="text-sm text-muted-foreground">{email}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Display name">
                    <Input
                      value={displayName}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </Field>
                  <Field
                    label="Country"
                    help="Used to show region-specific payment options (e.g. UPI in India)."
                  >
                    <Input
                      list="country-options"
                      value={currentCountry}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Select or type your country"
                    />
                    <datalist id="country-options">
                      {COMMON_COUNTRIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={email} disabled />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving || !displayName.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
                  </Button>
                  {saved && (
                    <span className="self-center text-sm text-success animate-fade-in">Saved</span>
                  )}
                  {saveError && (
                    <span className="self-center text-sm text-destructive">{saveError}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Account info" />
              <CardContent className="text-sm text-muted-foreground">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Plan</span>
                    <span className="font-medium text-foreground capitalize">{profile?.plan ?? "Free"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Credits</span>
                    <span className="font-medium text-foreground">{profile?.credits ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Role</span>
                    <span className="font-medium text-foreground capitalize">{profile?.role ?? "User"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Account status</span>
                    <span className="font-medium text-foreground">
                      {profile?.is_suspended ? "Suspended" : "Active"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Quick links" />
              <CardContent className="space-y-2">
                <Link
                  href="/account/security"
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    Security
                  </span>
                  <span className="text-muted-foreground">Open</span>
                </Link>
                <Link
                  href="/wallet"
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <span className="inline-flex items-center gap-2">
                    Wallet &amp; credits
                  </span>
                  <span className="text-muted-foreground">Open</span>
                </Link>
                <Link
                  href="/history"
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <span className="inline-flex items-center gap-2">
                    Audit history
                  </span>
                  <span className="text-muted-foreground">Open</span>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </RequireAuth>
  );
}
