/**
 * PayPal configuration — server-side only.
 *
 * Reads PayPal client credentials from the environment and mode (sandbox/live)
 * from admin_settings. The admin panel exposes the mode toggle; the secrets
 * themselves stay in environment variables and never reach the client.
 */

import { getSupabaseServer } from "@/lib/db/supabase-server";

export type PayPalMode = "sandbox" | "live";

export interface PayPalConfig {
  enabled: boolean;
  ready: boolean;
  mode: PayPalMode;
  clientId: string | null;
  apiBase: string;
}

const PAYPAL_API_BASES: Record<PayPalMode, string> = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

export async function getPayPalConfig(): Promise<PayPalConfig> {
  let mode: PayPalMode = "sandbox";
  try {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "payment_paypal_mode")
      .single();
    if (data?.value === "live") mode = "live";
  } catch {
    // default sandbox
  }

  const clientId = process.env.PAYPAL_CLIENT_ID ?? null;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? null;

  return {
    enabled: true,
    ready: Boolean(clientId && clientSecret),
    mode,
    clientId,
    apiBase: PAYPAL_API_BASES[mode],
  };
}
