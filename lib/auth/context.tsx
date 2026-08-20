"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getSupabaseBrowser } from "@/lib/db/supabase-browser";

export interface AuthProfile {
  id: string;
  email: string;
  display_name: string;
  role: "user" | "admin" | "support";
  avatar_url: string | null;
  country: string | null;
  credits: number;
  plan: string;
  is_suspended: boolean;
}

interface AuthState {
  user: { id: string; email: string } | null;
  profile: AuthProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from("profiles")
        .select("id, email, display_name, role, avatar_url, country, credits, plan, is_suspended")
        .eq("id", userId)
        .single();
      if (data) {
        setProfile(data as unknown as AuthProfile);
      }
    } catch {
      // Profile fetch failed — user may not exist in profiles yet
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      setUser({ id: currentUser.id, email: currentUser.email ?? "" });
      await fetchProfile(currentUser.id);
    }
  }, [fetchProfile]);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? "" });
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email ?? "" });
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
