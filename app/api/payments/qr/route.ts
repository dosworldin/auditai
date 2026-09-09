import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireAuth } from "@/lib/auth/session";
import { getPaymentGatewayConfig } from "@/lib/payments/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/payments/qr — server-side UPI QR for the custom gateway.
 * Generates a data-URL PNG from the admin-configured UPI id plus the
 * amount/purpose query params. The UPI id itself is never sent to the client.
 * Requires the custom gateway to be enabled; honors the India-only rule.
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const config = await getPaymentGatewayConfig();

  if (!config.customEnabled) {
    return NextResponse.json({ error: "Custom gateway is disabled" }, { status: 403 });
  }

  const isIndia = (user.profile.country ?? "").trim().toLowerCase() === "india";
  if (config.customIndiaOnly && !isIndia) {
    return NextResponse.json({ error: "Custom gateway is only available in India" }, { status: 403 });
  }

  if (!config.customUpiId) {
    return NextResponse.json({ error: "UPI QR is not configured" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const amount = Number(searchParams.get("amount"));
  const note = (searchParams.get("note") ?? "AuditAI credits").slice(0, 50);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
  }

  // Standard UPI deep link — scannable by all major Indian UPI apps.
  const upiUri = `upi://pay?pa=${encodeURIComponent(config.customUpiId)}&pn=${encodeURIComponent(
    "AuditAI",
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;

  const dataUrl = await QRCode.toDataURL(upiUri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });

  return NextResponse.json({ qrDataUrl: dataUrl, amount, currency: config.customCurrency });
}
