import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sseEmitter, type SSEEvent } from "@/lib/sse/emitter";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId || !clerkOrgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId))
    .limit(1);

  if (!org) {
    return new Response("Organization not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"));

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      // Subscribe to org events
      unsubscribe = sseEmitter.subscribe(org.id, (event: SSEEvent) => {
        try {
          const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Connection closed
        }
      });

      // Cleanup when client disconnects (after ~60s on Vercel)
      // The ReadableStream cancel() will handle cleanup
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
