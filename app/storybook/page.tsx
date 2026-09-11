import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import StorybookClient from "@/components/storybook/StorybookClient";
import { getStorybookSettings } from "@/lib/storybook/settings";
import { Container } from "@/components/layout/Container";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Storybooks — AuditAI",
  description:
    "A personalized, illustrated storybook with your child as the hero. AI-written story, character-consistent illustrations, print-ready PDF.",
};

export const dynamic = "force-dynamic";

export default async function StorybookPage() {
  const settings = await getStorybookSettings();

  if (!settings.enabled) {
    return (
      <Container className="py-16">
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-semibold text-foreground">Storybooks are temporarily unavailable</h1>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              The administrator has paused new storybook orders. Please check back soon.
            </p>
            <Link href="/dashboard">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <RequireAuth>
      <StorybookClient
        defaultPageCount={settings.defaultPageCount}
        minPageCount={settings.minPageCount}
        maxPageCount={settings.maxPageCount}
        pdfCredits={settings.pdfCredits}
      />
    </RequireAuth>
  );
}
