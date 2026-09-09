/**
 * Payments configuration — server-side only.
 *
 * Reads gateway on/off state and custom gateway details from admin_settings.
 * Admin is the single source of truth; nothing is hardcoded client-side.
 *
 * PayPal note: PayPal checkout SDK integration is prepared behind this config
 * (payment_paypal_enabled). The client flow is stubbed until PayPal client
 * credentials are supplied — flipping the toggle shows the PayPal option,
 * and /api/payments/config reports `paypalReady: false` when credentials are
 * missing so the UI can show "coming soon" instead of a broken flow.
 */

import { getSupabaseServer } from "@/lib/db/supabase-server";

export interface PaymentGatewayConfig {
  paypalEnabled: boolean;
  customEnabled: boolean;
  customIndiaOnly: boolean;
  customDisplayName: string;
  customUpiId: string;
  customInstructions: string[];
  customCurrency: string;
  paypalReady: boolean;
  paypalMode: "sandbox" | "live";
}

export async function getPaymentGatewayConfig(): Promise<PaymentGatewayConfig> {
  const supabase = await getSupabaseServer();

  const { data } = await supabase
    .from("admin_settings")
    .select("key, value")
    .in("key", [
      "payment_paypal_enabled",
      "payment_paypal_mode",
      "payment_custom_enabled",
      "payment_custom_india_only",
      "payment_custom_display_name",
      "payment_custom_qr_upi_id",
      "payment_custom_instructions",
      "payment_custom_currency",
    ]);

  const map = new Map<string, unknown>();
  for (const row of data ?? []) map.set(row.key, row.value);

  const bool = (key: string, fallback: boolean): boolean => {
    const v = map.get(key);
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v === "true";
    return fallback;
  };
  const str = (key: string, fallback: string): string => {
    const v = map.get(key);
    return typeof v === "string" && v.length > 0 ? v : fallback;
  };

  const customInstructionsRaw = map.get("payment_custom_instructions");
  const customInstructions = Array.isArray(customInstructionsRaw)
    ? (customInstructionsRaw as unknown[]).filter((i): i is string => typeof i === "string" && i.trim().length > 0)
    : [];

  const paypalReady =
    Boolean(process.env.PAYPAL_CLIENT_ID) && Boolean(process.env.PAYPAL_CLIENT_SECRET);

  const paypalModeRaw = map.get("payment_paypal_mode");
  const paypalMode: "sandbox" | "live" = paypalModeRaw === "live" ? "live" : "sandbox";

  return {
    paypalEnabled: bool("payment_paypal_enabled", false),
    customEnabled: bool("payment_custom_enabled", false),
    customIndiaOnly: bool("payment_custom_india_only", true),
    customDisplayName: str("payment_custom_display_name", "Bank / UPI Transfer"),
    customUpiId: str("payment_custom_qr_upi_id", ""),
    customInstructions,
    customCurrency: str("payment_custom_currency", "INR"),
    paypalReady,
    paypalMode,
  };
}
