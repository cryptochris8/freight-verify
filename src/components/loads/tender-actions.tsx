"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptTender, declineTender } from "@/app/actions/loads";
import { CheckCircle, XCircle } from "lucide-react";

interface TenderActionsProps {
  loadId: string;
  token: string;
}

export function TenderActions({ loadId, token }: TenderActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState("");

  function handleAccept() {
    startTransition(async () => {
      const res = await acceptTender(loadId, token);
      if (res.success) {
        setResult({ type: "success", message: "Tender accepted! The shipper has been notified." });
      } else {
        setResult({ type: "error", message: res.error || "Failed to accept tender." });
      }
    });
  }

  function handleDecline() {
    if (!reason.trim()) return;
    startTransition(async () => {
      const res = await declineTender(loadId, token, reason.trim());
      if (res.success) {
        setResult({ type: "success", message: "Tender declined. The shipper has been notified." });
      } else {
        setResult({ type: "error", message: res.error || "Failed to decline tender." });
      }
    });
  }

  if (result) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          {result.type === "success" ? (
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
          ) : (
            <XCircle className="h-12 w-12 text-red-600 mx-auto mb-3" />
          )}
          <p className="text-lg font-semibold">{result.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Respond to Tender</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showDecline ? (
          <div className="space-y-3">
            <Textarea
              placeholder="Please provide a reason for declining..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-20"
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleDecline} disabled={isPending || !reason.trim()}>
                {isPending ? "Processing..." : "Confirm Decline"}
              </Button>
              <Button variant="outline" onClick={() => setShowDecline(false)} disabled={isPending}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button onClick={handleAccept} disabled={isPending} className="flex-1">
              <CheckCircle className="mr-2 h-4 w-4" />
              {isPending ? "Processing..." : "Accept Tender"}
            </Button>
            <Button variant="outline" onClick={() => setShowDecline(true)} disabled={isPending} className="flex-1">
              <XCircle className="mr-2 h-4 w-4" />
              Decline Tender
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
