import type { Metadata } from "next";
import { getTool } from "@/lib/tools/registry";
import { SITE_URL, SITE_NAME } from "@/lib/site";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = getTool(params.slug);
  if (!tool) return {};

  const title = `${tool.name} — Free AI-Powered Audit`;
  const description =
    tool.description ||
    `Audit ${tool.name.toLowerCase()} documents in seconds with ${SITE_NAME}'s AI-powered analysis. Get risk scores, findings and actionable recommendations.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/tools/${tool.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/tools/${tool.slug}`,
      images: [{ url: `/api/og?tool=${encodeURIComponent(tool.name)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/og?tool=${encodeURIComponent(tool.name)}`],
    },
  };
}

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
