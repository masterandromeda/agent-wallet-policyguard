// Live SSE endpoint — streams real-time events to all connected dashboard clients
import { subscribe } from "@/lib/broadcast";
import { getStats } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") ?? "owner";

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(data: unknown) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      }

      // Initial state push
      send({ type: "init", payload: { stats: getStats(), role }, timestamp: new Date().toISOString() });

      // Subscribe to broadcast events
      unsubscribe = subscribe((event) => {
        // Filter by role if event specifies target roles
        if (event.forRoles && !event.forRoles.includes(role as "owner" | "customer" | "agent")) {
          return;
        }
        send(event);
      });

      // Heartbeat every 25 seconds
      const hb = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(hb);
        }
      }, 25000);

      request.signal.addEventListener("abort", () => {
        clearInterval(hb);
        if (unsubscribe) unsubscribe();
      });
    },
    cancel() {
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
