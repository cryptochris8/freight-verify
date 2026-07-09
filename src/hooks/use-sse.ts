"use client";

import { useEffect, useRef, useCallback } from "react";

export interface SSEMessage {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Hook that connects to the SSE dashboard endpoint and
 * calls the provided callback when events arrive.
 * Auto-reconnects using EventSource's built-in retry mechanism.
 */
export function useSSE(onMessage: (msg: SSEMessage) => void) {
  const callbackRef = useRef(onMessage);
  useEffect(() => {
    callbackRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const es = new EventSource("/api/sse/dashboard");

    const handleEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        callbackRef.current({ type: event.type, data });
      } catch {
        // Ignore parse errors
      }
    };

    // Listen for known event types
    es.addEventListener("alert_created", handleEvent);
    es.addEventListener("event_created", handleEvent);
    es.addEventListener("load_status_changed", handleEvent);

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here
    };

    return () => {
      es.close();
    };
  }, []);
}
