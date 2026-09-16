"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Mail,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

type Channel = "sms" | "email" | "call";

const CHANNELS: { id: Channel; label: string; icon: typeof MessageSquare; hint: string }[] = [
  { id: "sms", label: "SMS", icon: MessageSquare, hint: "Script aapke phone par message ban ke aayega — ready to show." },
  { id: "email", label: "Email", icon: Mail, hint: "Script email me deliver hoga — print ya forward karne ke liye." },
  { id: "call", label: "Fake call", icon: PhoneIncoming, hint: "Aapke phone par ek real incoming call aayega jo script bolega — perfect escape." },
];

const DELAYS = [
  { value: 0, label: "Abhi" },
  { value: 30, label: "30 sec" },
  { value: 60, label: "1 min" },
  { value: 180, label: "3 min" },
];

/** Simple vibration pattern for the fake-call screen. */
function startVibration() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([500, 300, 500, 300, 800]);
    } catch {
      /* unsupported */
    }
  }
}

export function RescuePanel({ script, situation }: { script: string; situation?: string }) {
  const [channel, setChannel] = useState<Channel>("sms");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [delay, setDelay] = useState(0);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // --- Fake call live state ---
  const [callActive, setCallActive] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const prepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startFakeCall = () => {
    setResult(null);
    setPreparing(true);
    prepTimer.current = setTimeout(() => {
      setPreparing(false);
      setCallActive(true);
      setCallTimer(0);
      startVibration();
    }, 3000);
  };

  const endFakeCall = () => {
    setCallActive(false);
    if (prepTimer.current) clearTimeout(prepTimer.current);
  };

  useEffect(() => {
    if (!callActive) return;
    tickRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [callActive]);

  useEffect(
    () => () => {
      if (prepTimer.current) clearTimeout(prepTimer.current);
      if (tickRef.current) clearInterval(tickRef.current);
    },
    [],
  );

  const mmss = `${String(Math.floor(callTimer / 60)).padStart(2, "0")}:${String(callTimer % 60).padStart(2, "0")}`;

  const send = async () => {
    setResult(null);
    setSending(true);
    try {
      const res = await fetch("/api/labs/rescue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel,
          phone: phone.trim(),
          email: email.trim(),
          script,
          situation,
          delaySeconds: delay,
        }),
      });
      const data: { ok?: boolean; error?: string; delayed?: boolean } = await res.json();
      if (!res.ok || !data.ok) {
        setResult({ ok: false, message: data.error ?? "Delivery failed. Try again." });
      } else if (channel === "sms" && data.delayed) {
        setResult({
          ok: true,
          message: `Scheduled! Message ${delay >= 60 ? `${Math.round(delay / 60)} minute` : `${delay} second`} me aa jayega.`,
        });
      } else {
        setResult({
          ok: true,
          message:
            channel === "email"
              ? "Email bhej diya gaya — inbox check karo."
              : channel === "call"
                ? "Call connect ho gaya — phone uthao!"
                : "SMS bhej diya gaya — messages kholo.",
        });
      }
    } catch {
      setResult({ ok: false, message: "Network error. Try again." });
    } finally {
      setSending(false);
    }
  };

  const selected = CHANNELS.find((c) => c.id === channel)!;
  const inputReady = channel === "email" ? email.trim().length > 3 : phone.trim().length >= 10;

  return (
    <Card className="border-warning/30">
      <CardHeader
        title="Get it delivered — live rescue"
        subtitle="Script ko sirf padhna nahi, turant apne phone par pao"
      />
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannel(c.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                channel === c.id
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              <c.icon className="h-4 w-4" /> {c.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{selected.hint}</p>

        {channel === "email" ? (
          <Field label="Email address">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Phone number" help="Indian 10-digit mobile ya international +E.164 format.">
            <Input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
        )}

        {channel === "sms" ? (
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">
              <Timer className="mr-1 inline h-4 w-4" /> Kab bhejna hai?
            </p>
            <div className="flex flex-wrap gap-2">
              {DELAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDelay(d.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    delay === d.value
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {delay > 0 ? (
              <p className="mt-2 text-xs text-warning">
                Pehle delay set karo, phir situation me busy ho jao — message waqt par khud aa jayega.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {channel === "call" ? (
            <Button size="lg" onClick={startFakeCall} disabled={false}>
              <Phone className="h-4 w-4" /> Trigger fake call (live screen)
            </Button>
          ) : (
            <Button size="lg" onClick={send} loading={sending} disabled={!inputReady}>
              <Bell className="h-4 w-4" />
              {delay > 0 ? "Schedule" : "Send now"}
            </Button>
          )}
          {channel === "call" ? (
            <Button variant="outline" size="lg" onClick={send} loading={sending} disabled={!inputReady}>
              <PhoneIncoming className="h-4 w-4" /> Real call via Twilio
            </Button>
          ) : null}
        </div>

        {result ? (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-xl border p-4 text-sm animate-fade-in ${
              result.ok
                ? "border-success/30 bg-success/5 text-foreground"
                : "border-destructive/30 bg-destructive/5 text-foreground"
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            )}
            <span>{result.message}</span>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          SMS/call ke liye admin ko Twilio credentials set karne honge (Admin → Credentials).
          Fake call live screen Twilio ke bina bhi kaam karti hai.
        </p>
      </CardContent>

      {/* ---------------- Live fake-call screen ---------------- */}
      {preparing ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 animate-fade-in">
          <p className="rounded-xl bg-black/70 px-6 py-4 text-sm font-medium text-white">
            Call aa rahi hai…
          </p>
        </div>
      ) : null}

      {callActive ? (
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-between bg-gradient-to-b from-neutral-900 via-neutral-950 to-black py-16 text-white animate-fade-in">
          <div className="text-center">
            <p className="text-sm text-neutral-400">Incoming call</p>
            <p className="mt-2 text-3xl font-semibold tracking-wide">Unknown</p>
            <p className="mt-1 text-sm text-neutral-400">Mobile</p>
            <p className="mt-8 text-5xl font-light tabular-nums">{mmss}</p>
          </div>

          <div className="max-w-sm px-8 text-center">
            <p className="rounded-2xl bg-white/10 px-5 py-4 text-base leading-relaxed backdrop-blur">
              {script}
            </p>
            <p className="mt-3 text-xs text-neutral-500">
              Ye call loudspeaker me sabko sunai de sakti hai — script use karke exit lo.
            </p>
          </div>

          <div className="flex items-center gap-10">
            <button
              type="button"
              onClick={endFakeCall}
              aria-label="End call"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={endFakeCall}
              aria-label="Dismiss"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-700 shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <X className="h-7 w-7" />
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
