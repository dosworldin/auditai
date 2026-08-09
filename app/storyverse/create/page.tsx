"use client";

import { useState } from "react";
import Link from "next/link";
import { BookPlus, Sparkles } from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { CheckboxRow } from "@/components/ui/Field";

export default function CreateStoryPage() {
  const [title, setTitle] = useState("");
  const [created, setCreated] = useState(false);
  const [continuityCheck, setContinuityCheck] = useState(true);
  const [safetyCheck, setSafetyCheck] = useState(true);
  const [votingCheck, setVotingCheck] = useState(true);

  return (
    <Container className="py-8">
      <PageHeader
        title="Create a Story"
        description="Set up a new collaborative story with its canon rules."
        icon={<BookPlus className="h-5 w-5" />}
        breadcrumbs={[{ label: "StoryVerse", href: "/storyverse" }, { label: "Create" }]}
      />

      <div className="mb-6">
        <BlueprintNote>
          Story creation is blueprint only. Persistence, collaboration
          invites and canon enforcement land in a future phase.
        </BlueprintNote>
      </div>

      {created ? (
        <Card className="animate-fade-in">
          <CardContent className="py-10 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              Story blueprint created (simulated)
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              In the full product, this would create the story, open the write
              workspace, and invite co-authors.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/storyverse/write/the-lighthouse-keeper">
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
                    <Select defaultValue="mystery">
                      <option value="mystery">Mystery</option>
                      <option value="sci-fi">Sci-Fi</option>
                      <option value="fantasy">Fantasy</option>
                      <option value="adventure">Adventure</option>
                      <option value="slice-of-life">Slice of Life</option>
                      <option value="thriller">Thriller</option>
                    </Select>
                  </Field>
                  <Field label="Target audience">
                    <Select defaultValue="general">
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
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Canon rules"
                subtitle="Blueprint placeholders - rule enforcement arrives later"
              />
              <CardContent className="space-y-3">
                <CheckboxRow
                  checked={continuityCheck}
                  onChange={setContinuityCheck}
                  label="AI continuity check"
                  description="AI validates that contributions stay consistent with established canon."
                />
                <CheckboxRow
                  checked={safetyCheck}
                  onChange={setSafetyCheck}
                  label="AI safety check"
                  description="AI flags harmful or disallowed content before voting begins."
                />
                <CheckboxRow
                  checked={votingCheck}
                  onChange={setVotingCheck}
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

            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={() => setCreated(true)} disabled={title.trim().length === 0}>
                <BookPlus className="h-4 w-4" /> Create story
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
                <p className="font-medium text-foreground">Attribution</p>
                <p className="mt-2">
                  Canon contributors are attributed per the platform's
                  contribution and revenue rules (future phase).
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </Container>
  );
}
