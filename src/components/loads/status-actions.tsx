"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { transitionLoadStatus, tenderLoad } from "@/app/actions/loads";
import type { LoadStatus } from "@/lib/loads/status-engine";

interface StatusActionsProps {
  loadId: string;
  status: string;
  carrierId: string | null;
  orgId: string;
  userId: string;
}

export function StatusActions({ loadId, status, carrierId, orgId, userId }: StatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleTransition(newStatus: LoadStatus) {
    setError(null);
    startTransition(async () => {
      const result = await transitionLoadStatus(loadId, newStatus, orgId, userId);
      if (!result.success) {
        setError(result.error || "Transition failed");
      } else {
        router.refresh();
      }
    });
  }

  function handleTender() {
    setError(null);
    startTransition(async () => {
      const result = await tenderLoad(loadId, orgId, userId);
      if (!result.success) {
        setError(result.error || "Tender failed");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "draft" && carrierId && (
          <Button onClick={handleTender} disabled={isPending}>
            Tender to Carrier
          </Button>
        )}
        {status === "tendered" && (
          <Button variant="outline" onClick={() => handleTransition("draft")} disabled={isPending}>
            Cancel Tender
          </Button>
        )}
        {status === "accepted" && (
          <Button onClick={() => handleTransition("in_transit")} disabled={isPending}>
            Mark In Transit
          </Button>
        )}
        {status === "in_transit" && (
          <Button onClick={() => handleTransition("delivered")} disabled={isPending}>
            Mark Delivered
          </Button>
        )}
        {status === "delivered" && (
          <Button onClick={() => handleTransition("completed")} disabled={isPending}>
            Complete Load
          </Button>
        )}
        {!["completed", "cancelled"].includes(status) && (
          <Button variant="destructive" onClick={() => handleTransition("cancelled")} disabled={isPending}>
            Cancel Load
          </Button>
        )}
      </div>
    </div>
  );
}
