"use client";

import { useState } from "react";
import { KeyRound, MonitorSmartphone, ShieldCheck, Smartphone } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Field";
import { BlueprintNote } from "@/components/layout/Container";

export default function AccountSecurityPage() {
  const [twoFactor, setTwoFactor] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  return (
    <Container className="py-8">
      <PageHeader
        title="Security"
        description="Protect your account with strong authentication and session controls."
        icon={<ShieldCheck className="h-5 w-5" />}
        breadcrumbs={[{ label: "Account", href: "/account" }, { label: "Security" }]}
      />

      <div className="mb-6">
        <BlueprintNote>
          Security controls are blueprint UI only. Authentication, password
          management and sessions are implemented in a future phase.
        </BlueprintNote>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Change password"
              icon={<KeyRound className="h-4 w-4" />}
            />
            <CardContent className="space-y-4">
              <Field label="Current password">
                <Input type="password" placeholder="Current password" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password">
                  <Input type="password" placeholder="New password" />
                </Field>
                <Field label="Confirm new password">
                  <Input type="password" placeholder="Confirm new password" />
                </Field>
              </div>
              <Button
                onClick={() => setPasswordSaved(true)}
                disabled={passwordSaved}
              >
                Update password
              </Button>
              {passwordSaved ? (
                <p className="text-sm text-success animate-fade-in">
                  Password update simulated - not persisted in blueprint.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Two-factor authentication"
              icon={<Smartphone className="h-4 w-4" />}
            />
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Authenticator app
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Add an extra layer of protection using an authenticator app.
                </p>
              </div>
              <Switch
                checked={twoFactor}
                onChange={setTwoFactor}
                label="Two-factor authentication"
              />
            </CardContent>
            {twoFactor ? (
              <CardContent className="border-t border-border">
                <p className="text-sm text-muted-foreground animate-fade-in">
                  Blueprint: enrolling an authenticator app will be available in
                  a future phase.
                </p>
              </CardContent>
            ) : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Active sessions"
              icon={<MonitorSmartphone className="h-4 w-4" />}
            />
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    This browser
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Current session
                  </p>
                </div>
                <Badge tone="success">Active</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Session management is implemented in a future phase.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
