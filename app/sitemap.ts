import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { TOOL_REGISTRY } from "@/lib/tools/registry";
import { LAB_REGISTRY } from "@/lib/labs/registry";

/**
 * Dynamic sitemap: all public marketing + listing pages, every tool page
 * (highest-volume SEO surface — 40 long-tail landing pages), labs, and StoryVerse.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = ([
    { url: `${SITE_URL}/`, changeFrequency: "weekly" as const, priority: 1 },
    { url: `${SITE_URL}/tools`, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${SITE_URL}/labs`, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${SITE_URL}/storyverse`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${SITE_URL}/storyverse/marketplace`, changeFrequency: "daily" as const, priority: 0.7 },
    { url: `${SITE_URL}/marketplace`, changeFrequency: "daily" as const, priority: 0.6 },
    { url: `${SITE_URL}/library`, changeFrequency: "daily" as const, priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly" as const, priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly" as const, priority: 0.3 },
  ]).map((p) => ({ ...p, lastModified: now }));

  const toolPages: MetadataRoute.Sitemap = TOOL_REGISTRY.map((t) => ({
    url: `${SITE_URL}/tools/${t.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const labPages: MetadataRoute.Sitemap = LAB_REGISTRY.map((l) => ({
    url: `${SITE_URL}/labs/${l.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...toolPages, ...labPages];
}
