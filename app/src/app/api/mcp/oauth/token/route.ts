import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/mcp/auth";

export const runtime = "nodejs";

const tokenSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1),
  redirect_uri: z.string().url(),
  client_id: z.string().min(1),
  code_verifier: z.string().min(1),
});

function pkceMatches(verifier: string, challenge: string): boolean {
  const expected = createHash("sha256")
    .update(verifier)
    .digest("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return expected === challenge;
}

function tokenError(code: string, description: string, status = 400) {
  return NextResponse.json(
    { error: code, error_description: description },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const bodyText = await req.text();
  let body: Record<string, string>;
  if (req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
    body = Object.fromEntries(new URLSearchParams(bodyText));
  } else {
    try {
      body = JSON.parse(bodyText) as Record<string, string>;
    } catch {
      body = Object.fromEntries(new URLSearchParams(bodyText));
    }
  }

  const parsed = tokenSchema.safeParse(body);
  if (!parsed.success) {
    return tokenError("invalid_request", parsed.error.message);
  }

  const auth = await prisma.mCPAuthorization.findUnique({
    where: { code: parsed.data.code },
  });
  if (!auth) return tokenError("invalid_grant", "Code not found");
  if (auth.expiresAt < new Date()) {
    await prisma.mCPAuthorization.delete({ where: { id: auth.id } });
    return tokenError("invalid_grant", "Code expired");
  }
  if (auth.mcpClientId !== parsed.data.client_id) {
    return tokenError("invalid_client", "Client mismatch");
  }
  if (auth.redirectUri !== parsed.data.redirect_uri) {
    return tokenError("invalid_grant", "redirect_uri mismatch");
  }
  if (!auth.codeChallenge || !pkceMatches(parsed.data.code_verifier, auth.codeChallenge)) {
    return tokenError("invalid_grant", "PKCE verification failed");
  }

  // Single-use code: delete on exchange to prevent replay
  await prisma.mCPAuthorization.delete({ where: { id: auth.id } });

  const accessToken = `mcpat_${randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600_000); // 30 days

  await prisma.mCPToken.create({
    data: {
      userId: auth.userId,
      mcpClientId: auth.mcpClientId,
      tokenHash: hashToken(accessToken),
      scopes: auth.scopes as never,
      expiresAt,
    },
  });

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      scope: ((auth.scopes as string[]) ?? []).join(" "),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
