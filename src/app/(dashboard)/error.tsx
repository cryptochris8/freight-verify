"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
    // Placeholder: Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center py-8 text-center">
          <div className="rounded-full bg-destructive/10 p-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Something went wrong</h3>
          <p className="text-sm text-muted-foreground mb-4">An unexpected error occurred. Please try again or contact support.</p>
          {error.digest && <p className="text-xs text-muted-foreground mb-4 font-mono">Error ID: {error.digest}</p>}
          <Button onClick={reset} variant="outline" className="gap-2"><RefreshCw className="h-4 w-4" /> Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
