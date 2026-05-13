import { subscribeResourceChange, type ResourceChangeEvent } from "./events";
import type { ToolContext } from "./types";
import { findResource, findTemplateMatch } from "./resources/registry";
import { hasScope } from "./auth";

/**
 * Build a Server-Sent Events stream that holds open after a JSON-RPC
 * resources/subscribe call. The first chunk is the JSON-RPC ack; subsequent
 * chunks are `notifications/resources/updated` events for the subscribed
 * URIs. Closes when the consumer aborts or the request is cancelled.
 *
 * Subscription matching:
 *  - Exact URI match against the subscribe param.
 *  - For templated URIs (e.g. clubos://members/{id}), match on the same
 *    path with the id bound. A subscribe to clubos://members/abc only
 *    receives events where event.uri === clubos://members/abc.
 *  - A subscribe to clubos://members/* would broadcast all members; not
 *    yet supported. v1 is exact-URI only.
 *
 * Capability check: each event is gated by the resource's required scopes
 * against the subscriber's token scopes — same intersection as
 * resources/read. Out-of-scope events are silently dropped.
 */
export function streamSubscriptions(args: {
  jsonRpcId: string | number | null;
  subscribedUris: Set<string>;
  ctx: ToolContext;
  signal?: AbortSignal;
}): Response {
  const encoder = new TextEncoder();
  const heartbeatMs = 25_000;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream already closed.
        }
      };

      const sendComment = (text: string) => {
        try {
          controller.enqueue(encoder.encode(`: ${text}\n\n`));
        } catch {
          /* closed */
        }
      };

      // 1. JSON-RPC subscribe acknowledgement.
      send({
        jsonrpc: "2.0",
        id: args.jsonRpcId,
        result: { ok: true, subscribed: Array.from(args.subscribedUris) },
      });

      // 2. Wire change events.
      const unsubscribe = subscribeResourceChange((event: ResourceChangeEvent) => {
        if (!args.subscribedUris.has(event.uri)) return;

        // Recheck capability — the user's caps could change mid-stream
        // (token revoked, role downgraded). Cheapest re-check is on the
        // resource definition for the URI; drop on miss.
        const resource = findResource(event.uri);
        const tpl = findTemplateMatch(event.uri);
        const required = resource?.required ?? tpl?.template.required ?? [];
        if (!hasScope(args.ctx, required)) return;

        send({
          jsonrpc: "2.0",
          method: "notifications/resources/updated",
          params: { uri: event.uri },
        });
      });

      // 3. Periodic comment frames keep proxies (Vercel, Cloudflare) from
      //    closing the connection due to idleness.
      const heartbeat = setInterval(() => sendComment("ping"), heartbeatMs);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      if (args.signal) {
        if (args.signal.aborted) cleanup();
        else args.signal.addEventListener("abort", cleanup, { once: true });
      }
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
