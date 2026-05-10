import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { effectiveCapabilities, type Capability } from "@/lib/capabilities";
import type { ToolContext } from "./types";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type AuthOutcome =
  | { ok: true; ctx: ToolContext }
  | { ok: false; error: string };

export async function authenticateBearer(headerValue: string | null): Promise<AuthOutcome> {
  if (!headerValue || !headerValue.toLowerCase().startsWith("bearer ")) {
    return { ok: false, error: "Missing or invalid Authorization header" };
  }
  const raw = headerValue.slice("Bearer ".length).trim();
  if (!raw) return { ok: false, error: "Empty bearer token" };

  const token = await prisma.mCPToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!token) return { ok: false, error: "Token not found" };
  if (token.revokedAt) return { ok: false, error: "Token revoked" };
  if (token.expiresAt && token.expiresAt < new Date()) {
    return { ok: false, error: "Token expired" };
  }
  if (!token.user) return { ok: false, error: "User not found" };

  await prisma.mCPToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  const userCaps = (token.user.capabilities ?? []) as Capability[];
  const userEffective = effectiveCapabilities(token.user.role, userCaps);
  const tokenScopes = (token.scopes ?? []) as Capability[];
  // The effective scope is the intersection: a token cannot grant more than
  // its user has; the user's effective caps cap the token's scope.
  const effectiveScopes = tokenScopes.filter((s) => userEffective.includes(s));

  return {
    ok: true,
    ctx: {
      user: {
        id: token.user.id,
        email: token.user.email,
        role: token.user.role,
        memberId: token.user.memberId,
        capabilities: userEffective,
      },
      scopes: effectiveScopes,
    },
  };
}

export function hasScope(ctx: ToolContext, required: Capability[]): boolean {
  return required.every(
    (cap) => ctx.scopes.includes(cap) && ctx.user.capabilities.includes(cap)
  );
}
