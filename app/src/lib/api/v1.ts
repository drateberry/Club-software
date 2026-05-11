import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateBearer, hasScope } from "@/lib/mcp/auth";
import type { ToolContext } from "@/lib/mcp/types";
import type { Capability } from "@/lib/capabilities";

export type ApiHandler<I> = (
  input: I,
  ctx: ToolContext,
  req: Request
) => Promise<NextResponse | unknown>;

/**
 * Build a Next route handler that:
 *  1. Authenticates a Bearer token via the same MCP auth pipeline.
 *  2. Validates the requested capabilities against the token scopes.
 *  3. Parses input (query for GET, JSON body for everything else).
 *  4. Calls the handler with a unified ToolContext.
 *
 * Returns a NextResponse passthrough when the handler returns one;
 * otherwise wraps the value as JSON 200.
 */
export function withApi<I>(opts: {
  scopes: Capability[];
  inputSchema?: z.ZodType<I>;
  source: "query" | "json" | "none";
  handler: ApiHandler<I>;
}) {
  return async (req: Request) => {
    const auth = await authenticateBearer(req.headers.get("authorization"));
    if (!auth.ok) {
      return new NextResponse(
        JSON.stringify({ error: "unauthorized", error_description: auth.error }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer realm="club-os", error="invalid_token"`,
          },
        }
      );
    }

    if (!hasScope(auth.ctx, opts.scopes)) {
      return NextResponse.json(
        {
          error: "forbidden",
          error_description: `Required scopes: ${opts.scopes.join(", ")}`,
        },
        { status: 403 }
      );
    }

    let rawInput: unknown = {};
    if (opts.source === "query") {
      rawInput = Object.fromEntries(new URL(req.url).searchParams);
    } else if (opts.source === "json") {
      const text = await req.text();
      if (text) {
        try {
          rawInput = JSON.parse(text);
        } catch {
          return NextResponse.json(
            { error: "invalid_json" },
            { status: 400 }
          );
        }
      }
    }

    let parsed: I;
    if (opts.inputSchema) {
      const result = opts.inputSchema.safeParse(rawInput);
      if (!result.success) {
        return NextResponse.json(
          { error: "invalid_input", issues: result.error.issues },
          { status: 400 }
        );
      }
      parsed = result.data;
    } else {
      parsed = rawInput as I;
    }

    try {
      const result = await opts.handler(parsed, auth.ctx, req);
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result);
    } catch (err) {
      const message = (err as Error).message;
      // Preserve Next.js redirects which throw as control flow
      if (message?.startsWith("NEXT_REDIRECT")) throw err;
      console.error("[api/v1] handler error", err);
      return NextResponse.json(
        { error: "internal_error", error_description: message },
        { status: 500 }
      );
    }
  };
}

/**
 * Returns the resolved memberId scope for a request:
 *  - MEMBER role tokens are forced to their own memberId
 *  - STAFF/ADMIN tokens may pass any memberId, or null for "all"
 */
export function scopeMemberId(
  ctx: ToolContext,
  requested: string | undefined
): { ok: true; memberId: string | null } | { ok: false; status: 403 | 400 } {
  if (ctx.user.role === "MEMBER") {
    if (!ctx.user.memberId) return { ok: false, status: 403 };
    if (requested && requested !== ctx.user.memberId) {
      return { ok: false, status: 403 };
    }
    return { ok: true, memberId: ctx.user.memberId };
  }
  return { ok: true, memberId: requested ?? null };
}
