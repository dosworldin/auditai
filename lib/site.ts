/**
 * Central site configuration for SEO metadata.
 * Set NEXT_PUBLIC_SITE_URL in Vercel env vars once your custom domain is live;
 * until then the current Vercel domain is the canonical URL.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://auditai-peach.vercel.app";

export const SITE_NAME = "AuditAI";

export const SITE_DESCRIPTION =
  "AuditAI helps individuals and businesses understand documents — contracts, invoices, policies and more — with professional AI-powered audits. 40+ audit tools, creative Labs, and StoryVerse collaborative publishing.";
