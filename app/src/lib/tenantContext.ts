import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped tenant context. Wraps any block of code in
 * `withTenant(clubId, () => ...)` so Prisma queries inside the block
 * pick up the clubId automatically (see lib/db.ts).
 *
 * When no context is active, queries run without auto-injection — this
 * is intentional for:
 *  - Auth.js bootstrap (looking up User by email before we know the
 *    club)
 *  - pg-boss workers running scheduled jobs
 *  - Webhook handlers that resolve tenant from the payload
 *  - Seed scripts
 *
 * Each of those entry points opts in to a tenant scope explicitly when
 * it's ready.
 */
export type TenantContext = {
  clubId: string;
  /** Marks operator-level requests; auto-scoping is bypassed. */
  asOperator?: boolean;
};

declare global {
  var __tenantStore: AsyncLocalStorage<TenantContext> | undefined;
}

function getStore(): AsyncLocalStorage<TenantContext> {
  if (!globalThis.__tenantStore) {
    globalThis.__tenantStore = new AsyncLocalStorage<TenantContext>();
  }
  return globalThis.__tenantStore;
}

export function withTenant<T>(clubId: string, fn: () => Promise<T> | T): Promise<T> {
  return Promise.resolve(getStore().run({ clubId }, fn));
}

/**
 * Pin the tenant context to the current async chain — no callback. Use
 * this from guards (requireSession) so every Server Action automatically
 * runs in the right tenant without wrapping its body. AsyncLocalStorage's
 * enterWith persists the store across subsequent awaits in this chain.
 */
export function enterTenantContext(clubId: string): void {
  getStore().enterWith({ clubId });
}

export function enterOperatorContext(): void {
  getStore().enterWith({ clubId: "*", asOperator: true });
}

/** Operator scope — bypasses auto-injection. Use sparingly. */
export function withOperatorScope<T>(fn: () => Promise<T> | T): Promise<T> {
  return Promise.resolve(getStore().run({ clubId: "*", asOperator: true }, fn));
}

export function getTenantContext(): TenantContext | null {
  return getStore().getStore() ?? null;
}

export function getTenantClubId(): string | null {
  const ctx = getTenantContext();
  if (!ctx || ctx.asOperator) return null;
  return ctx.clubId;
}

export function requireTenantClubId(): string {
  const id = getTenantClubId();
  if (!id) throw new Error("No tenant context active");
  return id;
}
