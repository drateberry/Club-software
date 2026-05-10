import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/mcp/auth";
import { handleRequest, type JsonRpcRequest } from "@/lib/mcp/server";

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

  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = (await req.json()) as JsonRpcRequest | JsonRpcRequest[];
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 }
    );
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((r) => handleRequest(r, auth.ctx)));
    return NextResponse.json(responses);
  }

  const response = await handleRequest(body, auth.ctx);
  return NextResponse.json(response);
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
