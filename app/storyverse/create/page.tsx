"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookPlus, Loader2, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { CheckboxRow } from "@/components/ui/Field";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function CreateStoryPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("mystery");
  const [synopsis, setSynopsis] = useState("");
  const [storyType, setStoryType] = useState("pool_open");
  const [targetAudience, setTargetAudience] = useState("general");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/storyverse/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: synopsis.trim() || `${title} - A ${genre} story`,
          genre,
          language: "English",
          storyType,
          tags: [genre.toLowerCase(), targetAudience],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create story");
        return;
      }

      const data = await res.json();
      setCreated(data.story?.id ?? "new-story");
    } catch {
      setError("Failed to create story. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title="Create a Story"
          description="Set up a new collaborative story with its canon rules."
          icon={<BookPlus className="h-5 w-5" />}
          breadcrumbs={[{ label: "StoryVerse", href: "/storyverse" }, { label: "Create" }]}
        />

        {created ? (
          <Card className="animate-fade-in">
            <CardContent className="py-10 text-center">
              <Sparkles className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">
                Story created successfully!
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Your story is now active. Start writing or invite co-authors to join.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href={`/storyverse/write/${created}`}>
                  <Button>Open the write workspace</Button>
                </Link>
                <Link href="/storyverse">
                  <Button variant="outline">Back to StoryVerse</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader title="Story basics" />
                <CardContent className="space-y-4">
                  <Field label="Story title" htmlFor="title">
                    <Input
                      id="title"
                      placeholder="e.g. The Lighthouse Keeper"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Genre">
                      <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
                        <option value="mystery">Mystery</option>
                        <option value="sci-fi">Sci-Fi</option>
                        <option value="fantasy">Fantasy</option>
                        <option value="adventure">Adventure</option>
                        <option value="slice-of-life">Slice of Life</option>
                        <option value="thriller">Thriller</option>
                      </Select>
                    </Field>
                    <Field label="Story type">
                      <Select value={storyType} onChange={(e) => setStoryType(e.target.value)}>
                        <option value="pool_open">Pool Open (anyone can participate)</option>
                        <option value="pool_private">Pool Private (invitation only)</option>
                        <option value="solo_open">Solo Open (single author)</option>
                        <option value="solo_ai">Solo AI (with AI assistance)</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Target audience">
                      <Select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}>
                        <option value="general">General</option>
                        <option value="young-adult">Young Adult</option>
                        <option value="adult">Adult</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Premise / synopsis" help="A short summary co-authors use as their north star.">
                    <Textarea
                      rows={4}
                      placeholder="What is this story about?"
                      value={synopsis}
                      onChange={(e) => setSynopsis(e.target.value)}
                    />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title="Canon rules"
                  subtitle="StoryVerse enforces these rules automatically"
                />
                <CardContent className="space-y-3">
                  <CheckboxRow
                    checked={true}
                    onChange={() => {}}
                    label="AI continuity check"
                    description="AI validates that contributions stay consistent with established canon."
                  />
                  <CheckboxRow
                    checked={true}
                    onChange={() => {}}
                    label="Community voting"
                    description="Co-authors vote on contributions; winners become canon."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Rounds per chapter">
                      <Select defaultValue="5">
                        <option value="3">3</option>
                        <option value="5">5</option>
                        <option value="7">7</option>
                        <option value="10">10</option>
                      </Select>
                    </Field>
                    <Field label="Snippets per round">
                      <Select defaultValue="4">
                        <option value="2">2</option>
                        <option value="4">4</option>
                        <option value="6">6</option>
                        <option value="8">8</option>
                      </Select>
                    </Field>
                  </div>
                </CardContent>
              </Card>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="lg" onClick={handleCreate} disabled={title.trim().length === 0 || creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookPlus className="h-4 w-4" />}
                  {creating ? "Creating..." : "Create story"}
                </Button>
                <Link href="/storyverse">
                  <Button variant="outline" size="lg">Cancel</Button>
                </Link>
              </div>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader title="How creation works" />
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>1. You define the premise and canon rules.</p>
                  <p>2. Co-authors join and contribute snippets.</p>
                  <p>3. AI checks continuity and safety.</p>
                  <p>4. The community votes. Winners become canon.</p>
                  <p>5. Chapters complete and the story progresses.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Contributor Agreement</p>
                  <p className="mt-2">
                    Every contributor must accept the Contributor Agreement before their first contribution.
                    The agreement covers publishing rights, distribution, and revenue share.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </Container>
    </RequireAuth>
  );
}
