"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { Loader2 } from "lucide-react";

/**
 * Inner component that reads searchParams (must be inside Suspense).
 */
function RequireAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && !user) {
      const currentPath = window.location.pathname;
      router.replace(`/auth?returnTo=${encodeURIComponent(currentPath)}`);
    }
  }, [user, loading, router, searchParams]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

/**
 * Client-side auth guard. Redirects to /auth if not authenticated.
 * Preserves the intended destination in returnTo.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RequireAuthGuard>{children}</RequireAuthGuard>
    </Suspense>
  );
}

/**
 * Require admin role. Shows access denied if not admin.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile || profile.role !== "admin") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-foreground">Access Denied</p>
        <p className="text-sm text-muted-foreground">You need admin access to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
