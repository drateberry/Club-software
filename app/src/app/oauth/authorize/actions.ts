"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { logAudit } from "@/lib/audit";

export async function issueAuthorizationCode(formData: FormData) {
  const session = await requireSession();
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const state = String(formData.get("state") ?? "");
  const scopes = formData.getAll("scope").map(String).filter(Boolean);

  const client = await prisma.mCPClient.findUnique({ where: { clientId } });
  if (!client) {
    redirect("/oauth/authorize/error?msg=Unknown%20client");
  }
  if (!((client!.redirectUris as string[]) ?? []).includes(redirectUri)) {
    redirect("/oauth/authorize/error?msg=Invalid%20redirect_uri");
  }

  const code = `auth_${randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 5 * 60_000);

  await prisma.mCPAuthorization.create({
    data: {
      userId: session.user.id,
      mcpClientId: clientId,
      scopes,
      code,
      codeChallenge,
      redirectUri,
      expiresAt,
    },
  });

  await logAudit(session.user.id, "settings.update", "MCPClient", clientId, {
    action: "authorize",
    scopes,
  });

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}
