"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MessageSquareText, Loader2, Plus, Send } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/context";

interface Discussion {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  profiles?: { display_name: string };
}

interface Reply {
  id: string;
  content: string;
  created_at: string;
  profiles?: { display_name: string };
}

export default function StoryVerseDiscussionPage() {
  const { user } = useAuth();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  const loadDiscussions = useCallback(async () => {
    try {
      const res = await fetch("/api/storyverse/discussions");
      if (res.ok) {
        const data = await res.json();
        setDiscussions(data.discussions ?? []);
        if (data.discussions?.length && !activeId) {
          setActiveId(data.discussions[0].id);
        }
      }
    } catch {
      // Failed
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    loadDiscussions();
  }, [loadDiscussions]);

  useEffect(() => {
    if (!activeId) return;
    setLoadingReplies(true);
    fetch(`/api/storyverse/discussions/${activeId}`)
      .then((r) => r.json())
      .then((d) => setReplies(d.replies ?? []))
      .catch(() => setReplies([]))
      .finally(() => setLoadingReplies(false));
  }, [activeId]);

  const postReply = async () => {
    if (!activeId || !replyText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/storyverse/discussions/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplies((prev) => [...prev, data.reply]);
        setReplyText("");
      }
    } catch {
      // Failed
    } finally {
      setPosting(false);
    }
  };

  const createDiscussion = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/storyverse/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setDiscussions((prev) => [data.discussion, ...prev]);
        setActiveId(data.discussion.id);
        setShowNew(false);
        setNewTitle("");
        setNewContent("");
      }
    } catch {
      // Failed
    } finally {
      setCreating(false);
    }
  };

  const active = discussions.find((d) => d.id === activeId);

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title="Community Discussions"
          description="Coordinate canon, debate plot twists, and shape the future of your stories."
          icon={<MessageSquareText className="h-5 w-5" />}
          breadcrumbs={[
            { label: "StoryVerse", href: "/storyverse" },
            { label: "Discussions" },
          ]}
          actions={
            user ? (
              <Button size="sm" onClick={() => setShowNew(!showNew)}>
                <Plus className="h-4 w-4" /> New discussion
              </Button>
            ) : null
          }
        />

        {showNew && (
          <Card className="mb-6">
            <CardContent className="space-y-4">
              <Field label="Title">
                <Input
                  placeholder="Discussion topic"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </Field>
              <Field label="Content">
                <Textarea
                  rows={4}
                  placeholder="Start the conversation..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <Button onClick={createDiscussion} disabled={creating || !newTitle.trim() || !newContent.trim()}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
                <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : discussions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No discussions yet. Start one!</p>
            ) : (
              discussions.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveId(thread.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    activeId === thread.id
                      ? "border-primary bg-accent/40"
                      : "border-border bg-card hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{thread.title}</p>
                    {thread.is_pinned && <Badge tone="primary">Pinned</Badge>}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {thread.profiles?.display_name ?? "Unknown"} · {new Date(thread.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="space-y-6 lg:col-span-2">
            {active ? (
              <>
                <Card>
                  <CardContent>
                    <h2 className="font-semibold text-foreground">{active.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      By {active.profiles?.display_name ?? "Unknown"} · {new Date(active.created_at).toLocaleString()}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{active.content}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-4">
                    <p className="text-sm font-semibold text-foreground">Replies ({replies.length})</p>
                    {loadingReplies ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading replies...
                      </div>
                    ) : replies.length > 0 ? (
                      <div className="space-y-3">
                        {replies.map((r) => (
                          <div key={r.id} className="rounded-lg border border-border p-3">
                            <p className="text-xs font-medium text-foreground">
                              {r.profiles?.display_name ?? "Unknown"} · {new Date(r.created_at).toLocaleString()}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No replies yet. Be the first!</p>
                    )}

                    {user && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Write a reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              postReply();
                            }
                          }}
                        />
                        <Button onClick={postReply} disabled={posting || !replyText.trim()}>
                          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Select a discussion or start a new one
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-2">
              <Link href="/storyverse">
                <Button variant="outline">Back to StoryVerse</Button>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </RequireAuth>
  );
}
