import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tool = searchParams.get("tool")?.slice(0, 60);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0f111a 0%, #1a1d2e 60%, #232a4d 100%)",
          color: "#fafafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 88,
              height: 88,
              borderRadius: 24,
              background: "linear-gradient(135deg, #6366f1, #14b8a6)",
              fontSize: 48,
              fontWeight: 700,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>
            {tool ? `${tool}` : SITE_NAME}
          </div>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 30,
            lineHeight: 1.4,
            color: "#9ca3af",
            maxWidth: 900,
          }}
        >
          {tool
            ? SITE_DESCRIPTION
            : "40+ AI-powered document audit tools, creative Labs, and collaborative StoryVerse publishing."}
        </div>
        <div style={{ marginTop: 40, display: "flex", gap: 16, fontSize: 24, color: "#a5b4fc" }}>
          <span>🔍 40+ Audit Tools</span>
          <span>·</span>
          <span>🧪 Labs</span>
          <span>·</span>
          <span>📚 StoryVerse</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
