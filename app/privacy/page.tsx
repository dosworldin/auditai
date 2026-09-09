import Link from "next/link";
import { Container } from "@/components/layout/Container";

export const metadata = {
  title: "Privacy Policy — AuditAI",
  description: "How AuditAI collects, uses, and protects your data.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <Container className="py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: September 2026. This policy describes how the AuditAI platform
            (&quot;AuditAI&quot;, &quot;we&quot;) handles your information when you use the
            audit tools, Labs experiments, and the StoryVerse community publishing platform.
          </p>
        </div>

        <Section title="1. Information we collect">
          <p>
            <strong className="text-foreground">Account data:</strong> when you register we store your
            email address, a display name, your role, credit balance, and optional country. Authentication
            is handled by Supabase Auth; passwords are stored only as secure hashes by the auth provider.
          </p>
          <p>
            <strong className="text-foreground">Documents you submit:</strong> documents, text, and URLs
            you run through audit tools and Labs are processed to generate your report. Extracted text and
            the resulting report are stored with your account so you can access your history.
          </p>
          <p>
            <strong className="text-foreground">StoryVerse content:</strong> stories, chapters,
            contributions, votes, discussions, wallet balances, and revenue records you create or earn on
            the platform.
          </p>
          <p>
            <strong className="text-foreground">Payment information:</strong> for manual (bank/UPI)
            payments we store your payment reference note and the payment proof you upload. Payment proofs
            are stored in a private storage bucket accessible only to you and platform administrators.
          </p>
          <p>
            <strong className="text-foreground">Support communications:</strong> support tickets and
            replies you send, including internal notes added by administrators.
          </p>
        </Section>

        <Section title="2. How we use your information">
          <ul className="list-disc space-y-1 pl-5">
            <li>To operate your account, track credits, and deliver audit reports.</li>
            <li>To process AI analysis: document content may be sent to our AI providers
              (DeepSeek primary, Google Gemini fallback) to generate analysis. We send only the
              extracted text needed for the analysis; API keys are never exposed to your browser.</li>
            <li>To run OCR on scanned documents and images when direct text extraction is not possible.</li>
            <li>To operate StoryVerse: publish contributions, calculate votes, maintain author wallets
              and revenue shares, and process payouts you request.</li>
            <li>To review manual payment proofs and prevent payment fraud or platform abuse.</li>
            <li>To respond to support tickets.</li>
          </ul>
        </Section>

        <Section title="3. Data sharing">
          <p>
            We do not sell your personal data. Document content is shared with AI providers solely to
            generate the analysis you requested. StoryVerse contributions are, by design, visible to other
            community members and, once published, to readers. Payment proofs are visible only to you and
            platform administrators. We may disclose information when required by law.
          </p>
        </Section>

        <Section title="4. Data security">
          <ul className="list-disc space-y-1 pl-5">
            <li>Row Level Security (RLS) restricts database access so users can read and modify only
              their own records.</li>
            <li>Payment proofs are stored in a private bucket; administrators access them through
              short-lived signed URLs.</li>
            <li>Server-side API routes perform all privileged operations; sensitive keys are never sent
              to the browser.</li>
          </ul>
        </Section>

        <Section title="5. Data retention and deletion">
          <p>
            Audit history and reports are retained while your account is active. StoryVerse published
            works follow the platform&apos;s archive and retention periods configured by administrators.
            You may request account deletion by contacting support; we will remove your profile and
            personal data, except where we must keep records for legal or financial reasons.
          </p>
        </Section>

        <Section title="6. Your rights">
          <p>
            Depending on your jurisdiction you may have rights to access, correct, export, or delete your
            personal data. You can update your display name and country on the Account page. For other
            requests, open a support ticket.
          </p>
        </Section>

        <Section title="7. Cookies and sessions">
          <p>
            We use essential cookies to keep you signed in and to remember your theme preference
            (light/dark). We do not use advertising or third-party tracking cookies.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>
            Questions about this policy? Open a ticket via the{" "}
            <Link href="/support" className="text-primary hover:underline">Support</Link> page.
          </p>
        </Section>
      </div>
    </Container>
  );
}
