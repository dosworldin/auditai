import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme/theme-engine";
import { AuthProvider } from "@/lib/auth/context";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LiveActivityToasts } from "@/components/activity/LiveActivityToasts";

export const metadata: Metadata = {
  title: {
    default: "AuditAI - Professional Document Audit Platform",
    template: "%s | AuditAI",
  },
  description:
    "AuditAI helps individuals and businesses understand documents - contracts, invoices, policies and more - with professional AI-powered audits.",
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
  );}
