"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f4f4f5" }}>
          <div style={{ maxWidth: 400, width: "100%", background: "#fff", borderRadius: 8, padding: "32px 24px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ marginBottom: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Something went wrong</h3>
            <p style={{ fontSize: 14, color: "#71717a", marginBottom: 16 }}>
              A critical error occurred. Please try again or contact support.
            </p>
            {error.digest && (
              <p style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 16, fontFamily: "monospace" }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: "8px 16px",
                border: "1px solid #e4e4e7",
                borderRadius: 6,
                background: "#fff",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
