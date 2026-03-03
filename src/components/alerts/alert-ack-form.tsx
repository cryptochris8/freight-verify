"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { acknowledgeAlert } from "@/app/actions/alerts";

interface AlertAckFormProps {
  alertId: string;
}

export function AlertAckForm({ alertId }: AlertAckFormProps) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await acknowledgeAlert(alertId, notes);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || "Failed to acknowledge alert");
      }
    });
  };

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Add notes about this acknowledgment (optional)..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <Button onClick={handleSubmit} disabled={isPending}>
        {isPending ? "Acknowledging..." : "Acknowledge Alert"}
      </Button>
    </div>
  );
}
