"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { generateVerification } from "@/app/actions/verification";

interface GeneratePickupCodeProps {
  loadId: string;
}

export function GeneratePickupCode({ loadId }: GeneratePickupCodeProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [otp, setOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateVerification(loadId);
      if (result.success && result.otp) {
        setOtp(result.otp);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to generate verification code");
      }
    });
  }

  function handleCopy() {
    if (otp) {
      navigator.clipboard.writeText(otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (otp) {
    return (
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="font-medium">Pickup verification code generated</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-muted rounded-lg px-6 py-3">
              <p className="text-2xl font-mono font-bold tracking-widest">{otp}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Send this code to the driver. It expires in 4 hours.
            The dock staff will enter this code to verify the pickup.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Pickup Verification</p>
            <p className="text-sm text-muted-foreground">Generate a code for dock staff to verify the pickup</p>
          </div>
          <Button onClick={handleGenerate} disabled={isPending}>
            {isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><KeyRound className="h-4 w-4 mr-2" /> Generate Pickup Code</>
            )}
          </Button>
        </div>
        {error && (
          <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
      </CardContent>
    </Card>
  );
}
