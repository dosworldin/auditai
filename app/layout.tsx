import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme/theme-engine";
import { AuthProvider } from "@/lib/auth/context";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LiveActivityToasts } from "@/components/activity/LiveActivityToasts";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AuditAI — 40+ AI Document Audit Tools, Labs & StoryVerse",
    template: "%s | AuditAI",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "document audit", "AI document analysis", "contract review", "invoice check",
    "salary slip audit", "privacy policy analyzer", "GDPR compliance tool",
    "AI tools", "StoryVerse", "collaborative writing",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "AuditAI — 40+ AI Document Audit Tools, Labs & StoryVerse",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "AuditAI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AuditAI — 40+ AI Document Audit Tools",
    description: SITE_DESCRIPTION,
    images: ["/api/og"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f111a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
              <LiveActivityToasts />
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
