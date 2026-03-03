"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  authorName: string | null;
  authorType: "user" | "carrier" | "system";
  content: string;
  createdAt: string;
}

interface MessageThreadProps {
  loadId: string;
  messages: Message[];
}

function getAuthorBadgeVariant(type: string) {
  switch (type) {
    case "user": return "default" as const;
    case "carrier": return "secondary" as const;
    case "system": return "outline" as const;
    default: return "outline" as const;
  }
}

export function MessageThread({ loadId, messages: initialMessages }: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    if (!content.trim()) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/loads/" + loadId + "/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim() }),
        });
        if (res.ok) {
          const newMsg = await res.json();
          setMessages((prev) => [...prev, newMsg]);
          setContent("");
        }
      } catch (e) {
        console.error("Failed to send message", e);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={scrollRef} className="space-y-4 max-h-96 overflow-y-auto mb-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No messages yet.</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{msg.authorName || "System"}</span>
                  <Badge variant={getAuthorBadgeVariant(msg.authorType)} className="text-xs">
                    {msg.authorType}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(msg.createdAt), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a message..."
            className="min-h-10 flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={isPending || !content.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
