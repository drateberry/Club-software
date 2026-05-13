import { EventEmitter } from "node:events";

/**
 * In-process pub/sub for MCP resource subscriptions. Today the deployment
 * model is single-process per club, so an EventEmitter is sufficient.
 * When/if we go multi-instance, swap the publish/subscribe pair for
 * Postgres LISTEN/NOTIFY; consumers stay unchanged.
 */
export type ResourceChangeEvent = {
  /** Canonical clubos:// URI that changed. */
  uri: string;
  /** A coarse entity tag clients can subscribe to as well. */
  entity: "member" | "invoice" | "event" | "conversation" | "house_charge" | "compliance" | "checkin";
  /** Stable id of the changed record. */
  id: string;
  /** "create" | "update" | "delete" (best-effort). */
  kind: "create" | "update" | "delete";
};

declare global {
  var __mcpEvents: EventEmitter | undefined;
}

function getEmitter(): EventEmitter {
  if (!globalThis.__mcpEvents) {
    const e = new EventEmitter();
    e.setMaxListeners(1000);
    globalThis.__mcpEvents = e;
  }
  return globalThis.__mcpEvents;
}

export function publishResourceChange(event: ResourceChangeEvent): void {
  getEmitter().emit("change", event);
}

export function subscribeResourceChange(
  handler: (event: ResourceChangeEvent) => void
): () => void {
  const emitter = getEmitter();
  emitter.on("change", handler);
  return () => emitter.off("change", handler);
}

/**
 * Helpers used by server actions / lib helpers to publish at the right
 * moments. Keep these tiny and synchronous — the actual notification fan-
 * out happens off-thread inside the emitter.
 */
export function memberChanged(memberId: string, kind: ResourceChangeEvent["kind"] = "update") {
  publishResourceChange({
    uri: `clubos://members/${memberId}`,
    entity: "member",
    id: memberId,
    kind,
  });
}

export function invoiceChanged(invoiceId: string, kind: ResourceChangeEvent["kind"] = "update") {
  publishResourceChange({
    uri: `clubos://invoices/${invoiceId}`,
    entity: "invoice",
    id: invoiceId,
    kind,
  });
}

export function eventChanged(eventId: string, kind: ResourceChangeEvent["kind"] = "update") {
  publishResourceChange({
    uri: `clubos://events/${eventId}`,
    entity: "event",
    id: eventId,
    kind,
  });
}

export function conversationChanged(conversationId: string, kind: ResourceChangeEvent["kind"] = "update") {
  publishResourceChange({
    uri: `clubos://conversations/${conversationId}`,
    entity: "conversation",
    id: conversationId,
    kind,
  });
}

export function houseChargeChanged(memberId: string, kind: ResourceChangeEvent["kind"] = "update") {
  publishResourceChange({
    uri: `clubos://house-accounts/${memberId}/balance`,
    entity: "house_charge",
    id: memberId,
    kind,
  });
}
