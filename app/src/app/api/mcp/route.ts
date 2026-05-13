import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/mcp/auth";
import { handleRequest, type JsonRpcRequest } from "@/lib/mcp/server";
import { consume, rateLimitHeaders } from "@/lib/api/rateLimit";

export const runtime = "nodejs";

function unauthorized(message: string): NextResponse {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer realm="club-os", error="invalid_token", error_description="${message}"`,
    },
  });
}

export async function POST(req: Request) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) return unauthorized(auth.error);

  // One MCP request can carry batched JSON-RPC calls; each costs a token.
  // The bucket selection is dynamic: tools/call against a mutation tool is
  // "write", everything else is "read".
  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = (await req.json()) as JsonRpcRequest | JsonRpcRequest[];
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 }
    );
  }

  const calls = Array.isArray(body) ? body : [body];
  const bucket = calls.some((c) => c.method === "tools/call") ? "write" : "read";
  const limit = consume(`u:${auth.ctx.user.id}`, bucket, calls.length);
  if (!limit.allowed) {
    return new NextResponse(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32029, message: `Rate limited; retry in ${limit.retryAfter}s` },
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", ...rateLimitHeaders(limit) },
      }
    );
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((r) => handleRequest(r, auth.ctx)));
    return NextResponse.json(responses, { headers: rateLimitHeaders(limit) });
  }

  const response = await handleRequest(body, auth.ctx);
  return NextResponse.json(response, { headers: rateLimitHeaders(limit) });
}

export async function GET() {
  return NextResponse.json(
    {
      protocol: "mcp",
      transport: "streamable-http",
      authorization_url: "/.well-known/oauth-authorization-server",
      hint: "POST JSON-RPC requests with Authorization: Bearer <token>",
    },
    { status: 200 }
  );
}
