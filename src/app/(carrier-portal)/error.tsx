"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";

export default function CarrierPortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold">FreightVerify</h1>
          <p className="text-sm text-muted-foreground">Carrier Portal</p>
        </div>
        <div className="rounded-lg border bg-card p-6 text-center space-y-3">
          <div className="rounded-full bg-destructive/10 p-3 mx-auto w-fit">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold">Something went wrong</h3>
          <p className="text-sm text-muted-foreground">An unexpected error occurred. Please try again.</p>
          {error.digest && <p className="text-xs text-muted-foreground font-mono">Error ID: {error.digest}</p>}
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
