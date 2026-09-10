"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Loader2, Mail, Lock, User } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useAuth } from "@/lib/auth/context";
import { consumeStoredReferral } from "@/lib/growth/referral";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/dashboard";
  const { user, signIn, signUp, loading } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      router.replace(returnTo);
    }
  }, [user, loading, router, returnTo]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return null;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const supabase = (await import("@/lib/db/supabase-browser")).getSupabaseBrowser();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset-password`,
      });
      if (resetError) {
        setError(resetError.message);
      } else {
        setError("");
        setMode("signin");
      }
    } catch {
      setError("Failed to send reset email");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, displayName);

      if (result.error) {
        setError(result.error);
      } else {
        // For sign-in, redirect immediately. For sign-up, show confirmation message.
        if (mode === "signin") {
          router.replace(returnTo);
        } else {
          // Apply stored referral code (best-effort, never blocks signup)
          const refCode = consumeStoredReferral();
          if (refCode) {
            try {
              await fetch("/api/auth/referral", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: refCode }),
              });
            } catch {
              // ignore — referral is best-effort
            }
          }
          setError("");
          setMode("signin");
          setEmail(email);
          setPassword("");
          setDisplayName("");
        }
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold text-foreground">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <span className="text-xl tracking-tight">AuditAI</span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to your account"
              : mode === "signup"
                ? "Create your account to get started"
                : "Reset your password"}
          </p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={mode === "reset" ? handleResetPassword : handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <Field label="Display name">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </Field>
              )}

              <Field label="Email">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </Field>

              <Field label="Password">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10"
                  />
                </div>
              </Field>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {mode === "signup" && !error && (
                <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-sm text-foreground">
                  Check your email for a confirmation link after signing up.
                </div>
              )}
              {mode === "reset" && !error && (
                <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-sm text-foreground">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "signin" ? (
                  "Sign in"
                ) : mode === "signup" ? (
                  "Create account"
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" && (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signup"); setError(""); }}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign up
                  </button>
                  <span className="mx-2">·</span>
                  <button
                    type="button"
                    onClick={() => { setMode("reset"); setError(""); }}
                    className="font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </>
              )}
              {mode === "signup" && (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signin"); setError(""); }}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
              {mode === "reset" && (
                <>
                  <button
                    type="button"
                    onClick={() => { setMode("signin"); setError(""); }}
                    className="font-medium text-primary hover:underline"
                  >
                    Back to sign in
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 text-center">
              <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
                Back to home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
