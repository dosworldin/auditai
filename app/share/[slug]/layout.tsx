import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const supabase = await getSupabaseAdmin();
    const { data } = await (supabase as any)
      .from("audit_reports")
      .select("tool_name, risk_label, findings_count, is_publicly_shared")
      .eq("public_share_slug", params.slug)
      .eq("is_publicly_shared", true)
      .single();

    if (data) {
      const title = `${data.tool_name} audit — ${data.risk_label} risk, ${data.findings_count} findings`;
      const description = `A real AuditAI report: ${data.tool_name} flagged ${data.findings_count} findings (${data.risk_label} risk). Run the same free audit on your own document.`;
      return {
        title,
        description,
        robots: { index: true, follow: false },
        openGraph: {
          title,
          description,
          type: "article",
        },
        twitter: { card: "summary_large_image", title, description },
      };
    }
  } catch {
    // fall through
  }
  return { title: "Shared Audit Report", robots: { index: false, follow: false } };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
