"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";

interface ChainIntegrityCheckerProps {
  loadId?: string;
}

export function ChainIntegrityChecker({ loadId }: ChainIntegrityCheckerProps) {
  const [result, setResult] = useState<{
    valid: boolean;
    brokenAt: number | null;
    totalEvents: number;
    verificationTimeMs: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleVerify = () => {
    startTransition(async () => {
      const start = performance.now();
      const params = new URLSearchParams();
      if (loadId) params.set("loadId", loadId);
      const res = await fetch("/api/events/verify-chain?" + params.toString());
      const data = await res.json();
      const elapsed = performance.now() - start;
      setResult({
        valid: data.valid,
        brokenAt: data.brokenAt,
        totalEvents: data.totalEvents,
        verificationTimeMs: Math.round(elapsed),
      });
    });
  };

  return (
    <div className="space-y-3">
      <Button onClick={handleVerify} disabled={isPending} variant="outline" className="gap-2">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Shield className="h-4 w-4" />
        )}
        Verify Chain Integrity
      </Button>

      {result && (
        <Card className={result.valid ? "border-green-500/50" : "border-red-500/50"}>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {result.valid ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">Chain Intact</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                  <span className="text-red-700">Chain Broken at Event #{result.brokenAt}</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Events checked: <Badge variant="outline">{result.totalEvents}</Badge></span>
              <span>Verification time: <Badge variant="outline">{result.verificationTimeMs}ms</Badge></span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
