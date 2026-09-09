import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getPaymentGatewayConfig } from "@/lib/payments/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/payments/config — which gateways the checkout should show for
 * the current user. The custom gateway is additionally filtered by the
 * admin's India-only setting using the user's profile country.
 */
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const config = await getPaymentGatewayConfig();

  const isIndia = (user.profile.country ?? "").trim().toLowerCase() === "india";
  const customAvailable = config.customEnabled && (!config.customIndiaOnly || isIndia);

  return NextResponse.json({
    paypal: {
      enabled: config.paypalEnabled,
      ready: config.paypalReady,
    },
    custom: {
      enabled: customAvailable,
      displayName: config.customDisplayName,
      currency: config.customCurrency,
      instructions: config.customInstructions,
      // QR is generated server-side per request; the UPI id itself is never sent.
      hasQr: Boolean(config.customUpiId),
    },
  });
}
