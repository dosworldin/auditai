import Link from "next/link";
import { Container } from "@/components/layout/Container";

export const metadata = {
  title: "Terms of Service — AuditAI",
  description: "The rules for using AuditAI tools, Labs, StoryVerse, and payments.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <Container className="py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: September 2026. By creating an account or using the AuditAI platform you agree
            to these terms.
          </p>
        </div>

        <Section title="1. The service">
          <p>
            AuditAI provides automated document analysis tools (&quot;Audit Tools&quot;), experimental
            modules (&quot;Labs&quot;), and a community collaborative publishing platform
            (&quot;StoryVerse&quot;). Features may change, and Labs in particular are experimental and
            provided without guarantees.
          </p>
        </Section>

        <Section title="2. Accounts">
          <ul className="list-disc space-y-1 pl-5">
            <li>You must provide a valid email address and are responsible for keeping your credentials secure.</li>
            <li>You are responsible for all activity under your account.</li>
            <li>We may suspend accounts that abuse the platform, attempt payment fraud, or violate these terms.</li>
          </ul>
        </Section>

        <Section title="3. Credits and payments">
          <ul className="list-disc space-y-1 pl-5">
            <li>Tool runs, Lab runs, and certain StoryVerse actions consume credits. Credits are
              prepaid and tracked in an append-only ledger.</li>
            <li>Credit packs are purchased through the checkout page. Where PayPal is enabled, payments are
              processed by PayPal; for the manual gateway (bank/UPI), credits are granted only after an
              administrator verifies your payment proof.</li>
            <li>Promotional free uses, when enabled by the platform, are limited per tool.</li>
            <li>Credits have no cash value and are not refundable except where the platform
              determines a charge was made in error.</li>
          </ul>
        </Section>

        <Section title="4. StoryVerse">
          <ul className="list-disc space-y-1 pl-5">
            <li>Contributions you submit are licensed to the platform for collaborative publication under
              the StoryVerse contributor agreement, which you must accept before contributing.</li>
            <li>Rounds, voting (including paid voting tokens), canon selection, and AI Editor processing
              follow the rules published on the platform and configured by its administrators.</li>
            <li>Platform revenue splits and inactivity holds are set by administrators and may change;
              the split that applied when your content was processed governs that content.</li>
            <li>The platform retains the publishing rights for stories created on the platform as
              described in the contributor agreement.</li>
            <li>Author earnings accumulate in a StoryVerse wallet and can be withdrawn once they meet the
              minimum payout threshold. Payouts are reviewed by administrators before being sent.</li>
            <li>Do not submit content you do not have the rights to use. Copyright-risk warnings and
              rewrites by the AI Editor do not make content legally safe.</li>
          </ul>
        </Section>

        <Section title="5. Acceptable use">
          <ul className="list-disc space-y-1 pl-5">
            <li>Do not upload unlawful, infringing, or malicious content, or content you are not
              authorized to analyze.</li>
            <li>Do not attempt to manipulate votes, wallets, ledgers, payments, or rate limits, or to
              access other users&apos; data.</li>
            <li>Automated scraping or abusive request volumes may be throttled or blocked.</li>
          </ul>
        </Section>

        <Section title="6. AI and OCR outputs">
          <p>
            Analysis, scores, findings, and AI Editor outputs are generated automatically, can contain
            errors, and are <strong className="text-foreground">informational only</strong>. They are not
            legal, financial, medical, tax, or security advice, and are not a substitute for review by a
            qualified professional. OCR output may be imperfect.
          </p>
        </Section>

        <Section title="7. Availability and liability">
          <p>
            The service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
            uninterrupted availability. To the maximum extent permitted by law, AuditAI is not liable for
            indirect or consequential damages, or for decisions made based on automated outputs.
          </p>
        </Section>

        <Section title="8. Changes and termination">
          <p>
            We may update these terms; significant changes will be reflected on this page with an updated
            date. You may stop using the platform and request account deletion at any time via{" "}
            <Link href="/support" className="text-primary hover:underline">Support</Link>.
          </p>
        </Section>
      </div>
    </Container>
  );
}
