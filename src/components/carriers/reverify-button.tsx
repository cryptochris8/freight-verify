"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface ReverifyButtonProps {
  carrierId: string;
}

export function ReverifyButton({ carrierId }: ReverifyButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/carriers/${carrierId}/verify`, {
          method: "POST",
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          toast.error(data.error || "FMCSA verification failed");
          return;
        }

        toast.success(
          `Verified: ${data.legalName} — Status: ${data.operatingStatus}`
        );
        // Refresh the page to show updated data
        window.location.reload();
      } catch {
        toast.error("Failed to connect to verification service");
      }
    });
  }

  return (
    <Button
      variant="outline"
      className="gap-2"
      onClick={handleClick}
      disabled={isPending}
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Verifying..." : "Re-verify with FMCSA"}
    </Button>
  );
}
