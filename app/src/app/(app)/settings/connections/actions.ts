"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { logAudit } from "@/lib/audit";

export async function revokeToken(tokenId: string) {
  const session = await requireSession();
  const token = await prisma.mCPToken.findUnique({ where: { id: tokenId } });
  if (!token || token.userId !== session.user.id) {
    redirect("/settings/connections?err=Not%20found");
  }
  await prisma.mCPToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });
  await logAudit(session.user.id, "settings.update", "MCPToken", tokenId, {
    action: "revoke",
  });
  revalidatePath("/settings/connections");
  redirect("/settings/connections?ok=Token%20revoked");
}
