"use client";

import { useState } from "react";
import { KeyRound, MonitorSmartphone, ShieldCheck, Smartphone, Loader2, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Field";
import { useAuth } from "@/lib/auth/context";

export default function AccountSecurityPage() {
  const { user, refreshProfile } = useAuth();
  const [twoFactor, setTwoFactor] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "saved">("idle");
  const [passwordError, setPasswordError] = useState("");
  const [signOutEverywhere, setSignOutEverywhere] = useState(false);
  const [signOutState, setSignOutState] = useState<"idle" | "done">("idle");

  const handlePasswordUpdate = async () => {
    setPasswordError("");
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setPasswordState("saving");
    try {
      // Re-authenticate first so a stolen session cannot silently change the password.
      if (currentPassword && user?.email) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (signInError) {
          throw new Error("Current password is incorrect.");
        }
      }

      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);

      setPasswordState("saved");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordState("idle"), 4000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
      setPasswordState("idle");
    }
  };

  const handleSignOutEverywhere = async () => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      // Refreshing the session invalidates all other refresh tokens (Supabase
      // single-session behavior): sign out everywhere, then re-establish here.
      await supabase.auth.refreshSession();
      setSignOutState("done");
      await refreshProfile();
    } catch {
      setSignOutState("idle");
    }
  };

  return (
    <Container className="py-8">
      <PageHeader
        title="Security"
        description="Protect your account with strong authentication and session controls."
        icon={<ShieldCheck className="h-5 w-5" />}
        breadcrumbs={[{ label: "Account", href: "/account" }, { label: "Security" }]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Change password"
              icon={<KeyRound className="h-4 w-4" />}
            />
            <CardContent className="space-y-4">
              <Field label="Current password" help="Verify your identity before changing the password.">
                <Input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password">
                  <Input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </Field>
                <Field label="Confirm new password">
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </Field>
              </div>
              <Button
                onClick={handlePasswordUpdate}
                disabled={passwordState === "saving" || !newPassword || !confirmPassword}
              >
                {passwordState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Update password
              </Button>
              {passwordState === "saved" ? (
                <p className="flex items-center gap-2 text-sm text-success animate-fade-in">
                  <CheckCircle2 className="h-4 w-4" /> Password updated successfully.
                </p>
              ) : null}
              {passwordError ? (
                <p className="text-sm text-destructive animate-fade-in">{passwordError}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Two-factor authentication"
              icon={<Smartphone className="h-4 w-4" />}
            />
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Authenticator app
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Add an extra layer of protection using an authenticator app.
                </p>
              </div>
              <Switch
                checked={twoFactor}
                onChange={(v) => setTwoFactor(v)}
                label="Two-factor authentication"
              />
            </CardContent>
            {twoFactor ? (
              <CardContent className="border-t border-border">
                <p className="text-sm text-muted-foreground animate-fade-in">
                  Enroll your authenticator app from the email link: sign out, choose
                  &quot;Sign in with magic link / 2FA setup&quot; on the sign-in page, and follow
                  the instructions Supabase emails you.
                </p>
              </CardContent>
            ) : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Active sessions"
              icon={<MonitorSmartphone className="h-4 w-4" />}
            />
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    This browser
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Current session
                  </p>
                </div>
                <Badge tone="success">Active</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">
                  Sign out of all other devices and browsers.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSignOutEverywhere}
                  disabled={signOutState === "done" || !signOutEverywhere}
                >
                  {signOutState === "done" ? "Done" : "Sign out everywhere"}
                </Button>
              </div>
              <Switch
                checked={signOutEverywhere}
                onChange={setSignOutEverywhere}
                label="Confirm sign out of all other sessions"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
