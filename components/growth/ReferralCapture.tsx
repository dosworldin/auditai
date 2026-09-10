"use client";

import { useEffect } from "react";
import { captureReferralFromUrl } from "@/lib/growth/referral";

/**
 * Mounts once in the root layout: silently stores ?ref=CODE from the URL
 * so a later signup can credit the referrer (30-day window).
 */
export function ReferralCapture() {
  useEffect(() => {
    captureReferralFromUrl(window.location.search);
  }, []);
  return null;
}
