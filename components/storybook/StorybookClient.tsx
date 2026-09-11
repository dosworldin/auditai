"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen, Wand2, Download, Share2, RefreshCcw,
  Trash2, Loader2, Baby, Palette, Languages, Sparkles,
  ShieldCheck, AlertTriangle, ArrowRight, CheckCircle2, Link2, Link2Off,
  Printer, Volume2, ScanSearch, PenLine,
} from "lucide-react";

import { Library } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea, Field, CheckboxRow } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Feedback";
import { RequireAuth } from "@/components/auth/RequireAuth";

/* ------------------------------------------------------------------ */

interface OrderSummary {
  id: string;
  status: string;
  childName: string;
  theme: string;
  artStyle: string;
  language: string;
  pageCount: number;
  title: string | null;
  pagesDone: number;
  pdfReady: boolean;
  shareSlug: string | null;
  error: string | null;
  updatedAt: string;
  photoUrl?: string;
  voiceStatus?: string | null;
}

interface SampleStorySummary {
  slug: string;
  title: string;
  tagline: string;
  emoji: string;
  artStyle: string;
  ageRange: string;
  pages: { pageNumber: number; text: string; imageUrl: string }[];
  ready: boolean;
}

const THEMES = [
  { value: "adventure", label: "🧭 Adventure" },
  { value: "friendship", label: "🤝 Friendship" },
  { value: "space", label: "🚀 Space Journey" },
  { value: "animals", label: "🦊 Animal Friends" },
  { value: "underwater", label: "🐠 Underwater World" },
  { value: "magic", label: "✨ Magic & Wonder" },
  { value: "bedtime", label: "🌙 Bedtime Calm" },
];

const STYLES = [
  { value: "watercolor", label: "Watercolor (classic)" },
  { value: "cartoon", label: "Bright Cartoon" },
  { value: "pixar3d", label: "3D Animated" },
  { value: "storybook", label: "Classic Storybook" },
];

const STATUS_STEPS: { key: string; label: string }[] = [
  { key: "draft", label: "Writing the story" },
  { key: "story_ready", label: "Illustrating" },
  { key: "illustrating", label: "Illustrating" },
  { key: "composing_pdf", label: "Composing your book" },
  { key: "ready", label: "Ready!" },
];

interface AnalysisResult {
  ageRating: string;
  summary: string;
  flags: string[];
  strengths: string[];
  risks: string[];
  illustrationScore: number;
  verdict: "fit" | "needs-work" | "not-fit";
  notes: string;
}

const NARRATION_VOICES = [
  { value: "Kore", label: "Kore — warm storyteller" },
  { value: "Puck", label: "Puck — bright & playful" },
  { value: "Charon", label: "Charon — cozy deep voice" },
  { value: "Fenrir", label: "Fenrir — energetic adventurer" },
  { value: "Aoede", label: "Aoede — gentle & melodic" },
  { value: "Orus", label: "Orus — classic audiobook" },
];

function statusIndex(status: string): number {
  const i = STATUS_STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

/* ------------------------------------------------------------------ */

function SampleStoriesSection() {
  const [samples, setSamples] = useState<SampleStorySummary[] | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    fetch("/api/storybook/samples")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!stop) setSamples(d?.samples ?? []); })
      .catch(() => { if (!stop) setSamples([]); });
    return () => { stop = true; };
  }, []);

  if (!samples || samples.length === 0) return null;
  const open = samples.find((s) => s.slug === openSlug) ?? null;

  return (
    <Card>
      <CardHeader
        title="Readymade sample books"
        subtitle="See exactly how a finished storybook looks — 2-page mini-books for every age, no AI wait."
        icon={<Library className="h-4 w-4" />}
      />
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {samples.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setOpenSlug(s.slug)}
              className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-ring/60 hover:bg-secondary/50"
            >
              <span className="text-2xl" role="img" aria-label={s.title}>{s.emoji}</span>
              <p className="mt-2 text-sm font-semibold text-foreground">{s.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.tagline}</p>
              <div className="mt-2"><Badge tone="neutral">{s.ageRange}</Badge></div>
            </button>
          ))}
        </div>

        <Dialog open={Boolean(open)} onClose={() => setOpenSlug(null)} title={open?.title ?? ""}>
          {open ? (
            <div className="space-y-4">
              {open.pages.map((p) => (
                <div key={p.pageNumber} className="overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt={`Sample page ${p.pageNumber}`} className="aspect-[4/3] w-full object-cover" />
                  <p className="p-4 text-sm leading-relaxed text-foreground">{p.text}</p>
                </div>
              ))}
              <p className="text-center text-xs text-muted-foreground">Like it? Create your own below — the AI puts your child in the hero's seat.</p>
            </div>
          ) : null}
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function AiStoryTools() {
  const [mode, setMode] = useState<"write" | "analyze" | null>(null);
  const [title, setTitle] = useState("");
  const [hero, setHero] = useState("");
  const [world, setWorld] = useState("");
  const [problem, setProblem] = useState("");
  const [tone, setTone] = useState("warm");
  const [words, setWords] = useState(250);
  const [storyText, setStoryText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ title?: string; story?: string } | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const runWrite = async () => {
    setBusy(true); setError(null); setResult(null); setAnalysis(null);
    try {
      const res = await fetch("/api/storybook/ai-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero, world, problem, tone, words, language: "en" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Could not write the story."); return; }
      setResult({ title: data.title, story: data.story });
      setStoryText(data.story);
      setTitle(data.title ?? "");
    } catch { setError("Network error — please try again."); }
    finally { setBusy(false); }
  };

  const runAnalyze = async () => {
    setBusy(true); setError(null); setAnalysis(null);
    try {
      const res = await fetch("/api/storybook/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, story: storyText }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Analysis failed."); return; }
      setAnalysis(data.analysis);
    } catch { setError("Network error — please try again."); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader
        title="Write with AI — or bring your own story"
        subtitle="No photo needed. The AI writes the story right here from your rules (small credit cost), and private stories stay free to keep. A paid analysis tells you if a story is fit to publish as an illustrated book."
        icon={<PenLine className="h-4 w-4" />}
      />
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant={mode === "write" ? "primary" : "outline"} size="sm" onClick={() => setMode("write")} icon={<Wand2 className="h-4 w-4" />}>Write a story with AI</Button>
          <Button variant={mode === "analyze" ? "primary" : "outline"} size="sm" onClick={() => setMode("analyze")} icon={<ScanSearch className="h-4 w-4" />}>Analyse a story</Button>
        </div>

        {mode === "write" ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Hero (required)" help="Who is the story about?">
                <Input value={hero} onChange={(e) => setHero(e.target.value)} maxLength={60} placeholder="e.g. Mimi the curious kitten" />
              </Field>
              <Field label="Tone">
                <Select value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="warm">Warm & heart-warming</option>
                  <option value="funny">Funny</option>
                  <option value="adventurous">Adventurous</option>
                  <option value="calm">Calm / bedtime</option>
                  <option value="mysterious">Gently mysterious</option>
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="World / setting (optional)"><Input value={world} onChange={(e) => setWorld(e.target.value)} maxLength={300} placeholder="e.g. a floating library above the clouds" /></Field>
              <Field label="Goal or problem (optional)"><Input value={problem} onChange={(e) => setProblem(e.target.value)} maxLength={300} placeholder="e.g. must find the lost last chapter" /></Field>
            </div>
            <Field label={`Length: about ${words} words`} help="The AI follows your rules exactly.">
              <input type="range" min={80} max={800} step={10} value={words} onChange={(e) => setWords(Number(e.target.value))} className="w-full accent-[rgb(var(--primary))]" />
            </Field>
            <Button onClick={runWrite} loading={busy} icon={<Wand2 className="h-4 w-4" />}>Write my story</Button>
          </div>
        ) : null}

        {mode === "analyze" ? (
          <div className="space-y-3">
            <Field label="Story title"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
            <Field label="Paste the full story" help="At least 100 characters. Analysis is a paid AI review.">
              <Textarea rows={8} value={storyText} onChange={(e) => setStoryText(e.target.value)} maxLength={20000} />
            </Field>
            <Button onClick={runAnalyze} loading={busy} disabled={storyText.trim().length < 100} icon={<ScanSearch className="h-4 w-4" />}>Analyse story fit</Button>
          </div>
        ) : null}

        {error ? <p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {error}</p> : null}

        {result?.story ? (
          <div className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-sm font-semibold text-foreground">{result.title}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{result.story}</p>
          </div>
        ) : null}

        {analysis ? (
          <div className="space-y-2 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={analysis.verdict === "fit" ? "success" : analysis.verdict === "needs-work" ? "info" : "destructive"}>
                {analysis.verdict === "fit" ? "Fit for a book" : analysis.verdict === "needs-work" ? "Needs polish" : "Not a fit"}
              </Badge>
              <Badge tone="neutral">{analysis.ageRating}</Badge>
              <Badge tone="info">Illustratable: {analysis.illustrationScore}/100</Badge>
            </div>
            <p className="text-sm text-foreground">{analysis.summary}</p>
            {analysis.strengths.length > 0 ? (<p className="text-xs text-muted-foreground">Strengths: {analysis.strengths.join(" · ")}</p>) : null}
            {analysis.risks.length > 0 ? (<p className="text-xs text-warning">Watch-outs: {analysis.risks.join(" · ")}</p>) : null}
            {analysis.flags.length > 0 ? (<p className="text-xs text-destructive">Flags: {analysis.flags.join(" · ")}</p>) : null}
            {analysis.notes ? (<p className="text-xs text-muted-foreground">Tip: {analysis.notes}</p>) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function CreateWizard({ onCreated, credits }: { onCreated: (id: string) => void; credits: number | null }) {
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("5");
  const [gender, setGender] = useState("unspecified");
  const [theme, setTheme] = useState("adventure");
  const [artStyle, setArtStyle] = useState("watercolor");
  const [language, setLanguage] = useState("en");
  const [pageCount, setPageCount] = useState(10);
  const [dedication, setDedication] = useState("");
  const [storyIdea, setStoryIdea] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onFile = useCallback((f: File | null) => {
    setPhoto(f);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(f ? URL.createObjectURL(f) : null);
  }, [photoPreview]);

  const submit = async () => {
    setError(null);
    if (!childName.trim()) { setError("Please enter the child's name."); return; }
    if (!photo) { setError("Please upload a clear photo of the child's face."); return; }
    if (!consent) { setError("Parental consent is required."); return; }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("childName", childName.trim());
      form.set("childAge", childAge);
      form.set("gender", gender);
      form.set("theme", theme);
      form.set("artStyle", artStyle);
      form.set("language", language);
      form.set("pageCount", String(pageCount));
      form.set("dedication", dedication);
      form.set("storyIdea", storyIdea);
      form.set("consent", "true");
      form.set("photo", photo);

      const res = await fetch("/api/storybook", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not create the order.");
        return;
      }
      onCreated(data.orderId);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Create a storybook"
        subtitle="Upload a photo, choose a theme — AI writes the story, illustrates every page with your child as the hero, and delivers a print-ready PDF."
      />
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Child's name" help="Exactly how it should appear in the story">
            <Input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="e.g. Aarav" maxLength={40} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <Select value={childAge} onChange={(e) => setChildAge(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </Select>
            </Field>
            <Field label="Hero pronouns">
              <Select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="unspecified">They</option>
                <option value="girl">She</option>
                <option value="boy">He</option>
              </Select>
            </Field>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Theme">
            <Select value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Art style">
            <Select value={artStyle} onChange={(e) => setArtStyle(e.target.value)}>
              {STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Story language">
            <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="es">Español</option>
            </Select>
          </Field>
        </div>

        <Field label={`Pages: ${pageCount}`} help="More pages = a longer adventure">
          <input
            type="range" min={6} max={16} step={2} value={pageCount}
            onChange={(e) => setPageCount(Number(e.target.value))}
            className="w-full accent-[rgb(var(--primary))]"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dedication (optional)" help="Printed on the cover, e.g. “For my little star”">
            <Input value={dedication} onChange={(e) => setDedication(e.target.value)} maxLength={200} placeholder="For my little star" />
          </Field>
          <Field label="Your story idea (optional)" help="The AI weaves it into the adventure">
            <Textarea rows={2} value={storyIdea} onChange={(e) => setStoryIdea(e.target.value)} maxLength={500} placeholder="e.g. loses a tooth and the tooth fairy takes her to the moon" />
          </Field>
        </div>

        <Field label="Child's photo" help="A clear, front-facing photo works best (JPG/PNG/WebP, max 8 MB).">
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-secondary">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Child preview" className="h-full w-full object-cover" />
              ) : (
                <Baby className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                Choose photo
              </Button>
              {photo ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => onFile(null)}>
                  Remove
                </Button>
              ) : null}
              <input
                ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </Field>

        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <CheckboxRow
              checked={consent}
              onChange={setConsent}
              label="I am the child's parent/legal guardian and I consent to this photo being used only to generate this storybook. The photo is never shared and is deleted automatically after generation."
            />
          </div>
        </div>

        {error ? (
          <p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {error}</p>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Generation takes a few minutes — you can leave this page and come back.
            {credits !== null ? ` Your balance: ${credits} credits.` : ""}
          </p>
          <Button onClick={submit} loading={submitting} size="lg" icon={<Wand2 className="h-4 w-4" />}>
            Create storybook
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function OrderTracker({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [failed, setFailed] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/storybook/${orderId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setFailed(data.order.status === "failed");
      }
    } catch { /* keep polling */ }
  }, [orderId]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop) return;
      await poll();
      if (!stop) setTimeout(tick, 6000);
    };
    tick();
    return () => { stop = true; };
  }, [poll]);

  const retry = async () => {
    setAdvancing(true);
    try {
      const res = await fetch(`/api/storybook/${orderId}/retry`, { method: "POST" });
      if (res.ok) { setFailed(false); poll(); }
    } finally {
      setAdvancing(false);
    }
  };

  if (!order) {
    return (
      <Card><CardContent className="flex items-center justify-center gap-3 py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Starting the magic…
      </CardContent></Card>
    );
  }

  const current = statusIndex(order.status);
  const progress = order.status === "ready" ? 100 : Math.min(90, (current / (STATUS_STEPS.length - 1)) * 100);

  return (
    <Card>
      <CardHeader
        title={order.title ?? `Storybook for ${order.childName}`}
        subtitle={`${order.pageCount} pages · ${order.artStyle} · ${order.language.toUpperCase()}`}
        actions={order.status === "ready" ? <Badge tone="success">Ready</Badge> : <Badge tone="info">{STATUS_STEPS[Math.min(current, STATUS_STEPS.length - 2)]?.label ?? order.status}</Badge>}
      />
      <CardContent className="space-y-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {STATUS_STEPS.slice(0, 4).map((s, i) => (
            <div key={s.key} className={`flex items-center gap-2 text-sm ${i <= current ? "text-foreground" : "text-muted-foreground"}`}>
              {i < current || order.status === "ready" ? <CheckCircle2 className="h-4 w-4 text-success" /> : i === current && order.status !== "ready" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <span className="h-4 w-4 rounded-full border border-border" />}
              {s.label}
            </div>
          ))}
        </div>

        {order.error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {order.error}
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={retry} loading={advancing} icon={<RefreshCcw className="h-3.5 w-3.5" />}>
                Try again
              </Button>
            </div>
          </div>
        ) : null}

        {order.status === "ready" ? (
          <>
            <VoicePanel orderId={order.id} voiceStatus={order.voiceStatus ?? null} onDone={() => poll()} />
            <BookDelivery orderId={order.id} childName={order.childName} shareSlug={order.shareSlug} onShared={(slug) => setOrder({ ...order, shareSlug: slug })} />
            <PodPanel orderId={order.id} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function VoicePanel({ orderId, voiceStatus, onDone }: { orderId: string; voiceStatus: string | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState("Kore");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(voiceStatus === "ready");

  const generate = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/storybook/${orderId}/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Narration failed."); return; }
      setReady(true);
      onDone();
    } catch { setError("Network error."); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Volume2 className="h-4 w-4 text-violet-500" /> Premium: AI voice narration
        </p>
        {ready ? (
          <Badge tone="success">Ready</Badge>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-56">
              {NARRATION_VOICES.map((v) => (<option key={v.value} value={v.value}>{v.label}</option>))}
            </Select>
            <Button size="sm" variant="outline" onClick={generate} loading={busy} icon={<Volume2 className="h-4 w-4" />}>
              Narrate my book
            </Button>
          </div>
        )}
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {ready ? (
        <AudioPlayer orderId={orderId} />
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Every page narrated by a warm AI storyteller — plays right in the book and is yours to keep. One-time credit charge per book.
        </p>
      )}
    </div>
  );
}

function AudioPlayer({ orderId }: { orderId: string }) {
  const [page, setPage] = useState(1);
  return (
    <div className="mt-3 flex items-center gap-3">
      <audio controls preload="none" className="h-9 w-full max-w-md" src={`/api/storybook/${orderId}/audio?page=${page}`} key={page} />
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))}>◀</Button>
        <span className="text-xs text-muted-foreground">Page {page}</span>
        <Button size="sm" variant="ghost" onClick={() => setPage((p) => p + 1)}>▶</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PodPanel({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<{ printCostUsd: number; chargeUsd: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ jobId: string; status: string } | null>(null);
  const [form, setForm] = useState({ name: "", line1: "", line2: "", city: "", region: "", postalCode: "", countryCode: "IN", phone: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const getQuote = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/storybook/${orderId}/pod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Quote failed."); return; }
      setQuote({ printCostUsd: data.printCostUsd, chargeUsd: data.chargeUsd });
    } catch { setError("Network error."); }
    finally { setBusy(false); }
  };

  const placeOrder = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/storybook/${orderId}/pod`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Print order failed."); return; }
      setPlaced({ jobId: data.jobId, status: data.status });
    } catch { setError("Network error."); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Printer className="h-4 w-4 text-primary" /> Printed copy, delivered to your door
        </p>
        {!placed ? (
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} icon={<Printer className="h-4 w-4" />}>
            {open ? "Hide print options" : "Order a printed copy"}
          </Button>
        ) : (
          <Badge tone="success">Print order {placed.status}</Badge>
        )}
      </div>

      {placed ? (
        <p className="mt-2 text-xs text-muted-foreground">Job ID {placed.jobId} — tracking appears here once the printer ships your book.</p>
      ) : open ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Full name" value={form.name} onChange={set("name")} maxLength={80} />
            <Input placeholder="Phone (for the courier)" value={form.phone} onChange={set("phone")} maxLength={30} />
            <Input placeholder="Address line 1" value={form.line1} onChange={set("line1")} maxLength={200} />
            <Input placeholder="Address line 2 (optional)" value={form.line2} onChange={set("line2")} maxLength={200} />
            <Input placeholder="City" value={form.city} onChange={set("city")} maxLength={80} />
            <Input placeholder="State / region (optional)" value={form.region} onChange={set("region")} maxLength={80} />
            <Input placeholder="Postal code" value={form.postalCode} onChange={set("postalCode")} maxLength={20} />
            <Input placeholder="Country code (IN, US…)" value={form.countryCode} onChange={set("countryCode")} maxLength={2} />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {quote ? (
            <p className="text-xs text-muted-foreground">
              Printing + shipping: ${quote.printCostUsd.toFixed(2)} — your charge: ${quote.chargeUsd.toFixed(2)} (includes platform fee). Credits are used to place the order.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!quote ? (
              <Button size="sm" variant="outline" onClick={getQuote} loading={busy}>Get shipping quote</Button>
            ) : (
              <Button size="sm" onClick={placeOrder} loading={busy} icon={<Printer className="h-4 w-4" />}>Place print order</Button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Your storybook as a real paperback — printed on demand and shipped worldwide from the nearest facility.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BookDelivery({ orderId, childName, shareSlug, onShared }: {
  orderId: string; childName: string; shareSlug: string | null; onShared: (slug: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const createShare = async () => {
    setBusy("share");
    try {
      const res = await fetch(`/api/storybook/${orderId}/share`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data.shareSlug) onShared(data.shareSlug);
    } finally { setBusy(null); }
  };

  const revokeShare = async () => {
    setBusy("revoke");
    try {
      const res = await fetch(`/api/storybook/${orderId}/share`, { method: "PUT" });
      if (res.ok) onShared("");
    } finally { setBusy(null); setConfirmRevoke(false); }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/s/storybook/${shareSlug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="rounded-xl border border-success/40 bg-success/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BookOpen className="h-4 w-4 text-success" /> {childName}&apos;s storybook is ready!
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/storybook/${orderId}/pdf`} download>
            <Button size="sm" icon={<Download className="h-4 w-4" />}>Download PDF</Button>
          </a>
          {shareSlug ? (
            <>
              <Button size="sm" variant="outline" onClick={copyLink} icon={copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}>
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(true)} icon={<Link2Off className="h-4 w-4" />}>
                Unshare
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={createShare} loading={busy === "share"} icon={<Share2 className="h-4 w-4" />}>
              Create share link
            </Button>
          )}
        </div>
      </div>
      {shareSlug ? (
        <p className="mt-2 break-all text-xs text-muted-foreground">
          Public flipbook: /s/storybook/{shareSlug} — anyone with the link can read the story. The PDF and photo stay private.
        </p>
      ) : null}

      <Dialog
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        title="Revoke share link?"
      >
        <p className="text-sm text-muted-foreground">
          Anyone who has the link will immediately lose access. You can create a new link anytime.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmRevoke(false)}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={revokeShare} loading={busy === "revoke"}>Revoke</Button>
        </div>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function OrdersList({ orders, onOpen, onDeleted }: { orders: OrderSummary[]; onOpen: (id: string) => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const remove = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/storybook/${id}`, { method: "DELETE" });
      if (res.ok) onDeleted();
    } finally { setDeleting(null); }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((o) => (
        <Card key={o.id} className="overflow-hidden">
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{o.title ?? `${o.childName}'s Storybook`}</p>
                <p className="text-xs text-muted-foreground">{o.pageCount} pages · {new Date(o.updatedAt).toLocaleDateString()}</p>
              </div>
              <Badge
                tone={o.status === "ready" ? "success" : o.status === "failed" ? "destructive" : "info"}
              >
                {o.status === "ready" ? "Ready" : o.status === "failed" ? "Failed" : "In progress"}
              </Badge>
            </div>
            {o.photoUrl ? (
              <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.photoUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpen(o.id)}>
                {o.status === "ready" ? "Open book" : "Track progress"} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(o.id)} loading={deleting === o.id} icon={<Trash2 className="h-3.5 w-3.5" />}>
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function StorybookClient({ defaultPageCount, minPageCount, maxPageCount, pdfCredits }: {
  defaultPageCount: number; minPageCount: number; maxPageCount: number; pdfCredits: number;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeOrder, setActiveOrder] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/storybook");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onCreated = (id: string) => {
    setActiveOrder(id);
    load();
  };

  return (
    <Container className="py-8">
      <PageHeader
        title="AI Storybooks"
        description="A personalized, illustrated storybook with your child as the hero — AI-written story, character-consistent illustrations, print-ready PDF."
        icon={<span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"><BookOpen className="h-5 w-5" /></span>}
        actions={
          <Link href="/dashboard">
            <Button variant="outline" size="sm">Back to dashboard</Button>
          </Link>
        }
      />

      <div className="space-y-8">
        {activeOrder ? (
          <OrderTracker orderId={activeOrder} />
        ) : null}

        <div id="samples" className="scroll-mt-20">
          <SampleStoriesSection />
        </div>
        <div id="create" className="scroll-mt-20">
          <CreateWizard onCreated={onCreated} credits={credits} />
        </div>
        <div id="ai-tools" className="scroll-mt-20">
          <AiStoryTools />
        </div>

        <div id="my-books" className="scroll-mt-20">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Sparkles className="h-5 w-5 text-primary" /> Your storybooks
          </h2>
          {!loaded ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : orders.length === 0 ? (
            <EmptyState
              title="No storybooks yet"
              description="Create your first magical storybook above."
              icon={<BookOpen className="h-8 w-8" />}
            />
          ) : (
            <OrdersList
              orders={orders}
              onOpen={(id) => { setActiveOrder(id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              onDeleted={load}
            />
          )}
        </div>
      </div>
    </Container>
  );
}
