"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, User, UserCog } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/PageHeader";
import { BlueprintNote } from "@/components/layout/Container";

export default function AccountPage() {
  const [name, setName] = useState("Alex Morgan");
  const [email, setEmail] = useState("alex@example.com");
  const [saved, setSaved] = useState(false);

  return (
    <Container className="py-8">
      <PageHeader
        title="Account"
        description="Manage your profile and preferences."
        icon={<User className="h-5 w-5" />}
      />

      <div className="mb-6">
        <BlueprintNote>
          Account changes are simulated in this blueprint phase. Authentication
          and profile persistence are implemented in a future phase.
        </BlueprintNote>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Profile"
              subtitle="Basic account information"
              icon={<UserCog className="h-4 w-4" />}
            />
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={name} className="h-14 w-14 text-lg" />
                <div>
                  <p className="font-medium text-foreground">{name}</p>
                  <p className="text-sm text-muted-foreground">{email}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setSaved(true)} disabled={saved}>
                  Save changes
                </Button>
                {saved ? (
                  <span className="self-center text-sm text-success animate-fade-in">
                    Saved (simulated)
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Preferences" />
            <CardContent className="text-sm text-muted-foreground">
              Notification preferences, default language, and audit defaults
              will be configurable here in a future phase.
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Account links" />
            <CardContent className="space-y-2">
              <Link
                href="/account/security"
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Security
                </span>
                <span className="text-muted-foreground">Open</span>
              </Link>
              <Link
                href="/wallet"
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <span className="inline-flex items-center gap-2">
                  Wallet &amp; credits
                </span>
                <span className="text-muted-foreground">Open</span>
              </Link>
              <Link
                href="/history"
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <span className="inline-flex items-center gap-2">
                  Audit history
                </span>
                <span className="text-muted-foreground">Open</span>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Account health</p>
              <ul className="mt-2 space-y-1.5">
                <li>Email verified: yes</li>
                <li>Two-factor auth: off</li>
                <li>Plan: Free</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
