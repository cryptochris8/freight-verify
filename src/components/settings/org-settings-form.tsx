"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface OrgSettings {
  name: string;
  plan: string;
  digestEnabled: boolean;
  digestRecipientEmails: string[];
}

export function OrgSettingsForm() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setName(data.name || "");
        setDigestEnabled(data.digestEnabled || false);
        setEmails(data.digestRecipientEmails || []);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load settings");
        setLoading(false);
      });
  }, []);

  function addEmail() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (emails.includes(trimmed)) {
      toast.error("Email already added");
      return;
    }
    if (emails.length >= 10) {
      toast.error("Maximum 10 recipients allowed");
      return;
    }
    setEmails([...emails, trimmed]);
    setNewEmail("");
  }

  function removeEmail(email: string) {
    setEmails(emails.filter((e) => e !== email));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            digestEnabled,
            digestRecipientEmails: emails,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || "Failed to save settings");
          return;
        }

        toast.success("Settings saved");
      } catch {
        toast.error("Failed to save settings");
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="org-name">Organization Name</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your organization name"
        />
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="digest-toggle">Daily Digest Email</Label>
            <p className="text-sm text-muted-foreground">
              Receive a daily summary of alerts, expiring documents, and load activity.
            </p>
          </div>
          <Switch
            id="digest-toggle"
            checked={digestEnabled}
            onCheckedChange={setDigestEnabled}
          />
        </div>

        {digestEnabled && (
          <div className="space-y-3 pt-2">
            <Label>Recipient Emails</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmail();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {emails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {emails.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Add at least one email to receive daily digests.
              </p>
            )}
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Settings"
        )}
      </Button>
    </div>
  );
}
