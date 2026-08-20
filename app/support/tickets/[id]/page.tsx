"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MessageCircle, Send, Shield } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/context";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  user_id: string;
}

interface Reply {
  id: string;
  content: string;
  is_internal_note: boolean;
  created_at: string;
  user_id: string;
  profiles?: { display_name: string; role: string };
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, profile } = useAuth();
  const [ticketId, setTicketId] = useState<string>("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Resolve params
  useEffect(() => {
    params.then((p) => setTicketId(p.id));
  }, [params]);

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        setTicket(data.ticket);
        setReplies(data.replies ?? []);
      }
    } catch {
      // Failed
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  const postReply = async () => {
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText.trim() }),
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

  const updateTicket = async (field: string, value: string) => {
    setUpdating(true);
    try {
      await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      loadTicket();
    } catch {
      // Failed
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Container className="py-8">
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Container>
    );
  }

  if (!ticket) {
    return (
      <Container className="py-8">
        <div className="text-center text-muted-foreground">Ticket not found</div>
      </Container>
    );
  }

  const isAdmin = profile?.role === "admin";

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title={ticket.subject}
          description={`Ticket ${ticket.id.slice(0, 8)} · ${ticket.category}`}
          icon={<MessageCircle className="h-5 w-5" />}
          breadcrumbs={[
            { label: "Support", href: "/support" },
            { label: ticket.subject },
          ]}
          actions={
            <Link href="/support">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" /> All tickets
              </Button>
            </Link>
          }
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Original message */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <Badge tone={ticket.status === "open" ? "info" : ticket.status === "resolved" ? "success" : "warning"}>
                    {ticket.status}
                  </Badge>
                  <Badge tone={ticket.priority === "urgent" ? "destructive" : "neutral"}>
                    {ticket.priority}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground mt-3">{ticket.message}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Created {new Date(ticket.created_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            {/* Replies */}
            <Card>
              <CardContent className="space-y-4">
                <p className="text-sm font-semibold text-foreground">Replies ({replies.length})</p>
                {replies.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-lg border p-3 ${
                      r.is_internal_note ? "border-warning bg-warning/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-foreground">
                        {r.profiles?.display_name ?? "Unknown"}
                      </p>
                      {r.profiles?.role === "admin" && (
                        <Badge tone="primary"><Shield className="h-3 w-3" /> Admin</Badge>
                      )}
                      {r.is_internal_note && (
                        <Badge tone="warning">Internal note</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{r.content}</p>
                  </div>
                ))}
                {replies.length === 0 && (
                  <p className="text-sm text-muted-foreground">No replies yet.</p>
                )}

                {/* Reply form */}
                <div className="flex gap-2 mt-4">
                  <Textarea
                    rows={2}
                    placeholder="Write a reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        postReply();
                      }
                    }}
                  />
                  <Button onClick={postReply} disabled={posting || !replyText.trim()} className="self-end">
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {isAdmin && (
              <Card>
                <CardContent className="space-y-4">
                  <p className="text-sm font-semibold text-foreground">Admin Actions</p>
                  <Field label="Status">
                    <Select
                      value={ticket.status}
                      onChange={(e) => updateTicket("status", e.target.value)}
                      disabled={updating}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </Select>
                  </Field>
                  <Field label="Priority">
                    <Select
                      value={ticket.priority}
                      onChange={(e) => updateTicket("priority", e.target.value)}
                      disabled={updating}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </Select>
                  </Field>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p><span className="font-medium text-foreground">Category:</span> {ticket.category}</p>
                <p><span className="font-medium text-foreground">Status:</span> {ticket.status}</p>
                <p><span className="font-medium text-foreground">Priority:</span> {ticket.priority}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </RequireAuth>
  );
}
