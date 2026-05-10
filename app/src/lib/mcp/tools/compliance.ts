import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeTool, textResult, type Tool } from "../types";

const listExpiring = makeTool({
  name: "compliance.list_expiring",
  description: "List compliance certificates expiring in the next N days (default 90).",
  required: ["compliance.read"],
  inputSchema: z.object({
    days: z.number().int().min(1).max(365).default(90),
  }),
  async handler(input, ctx) {
    const days = input.days ?? 90;
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);
    const certs = await prisma.complianceCertificate.findMany({
      where: {
        expiresOn: { lte: horizon, gte: new Date() },
        status: { not: "REVOKED" },
        ...(ctx.user.role === "MEMBER" && ctx.user.memberId
          ? { memberId: ctx.user.memberId }
          : {}),
      },
      include: { member: { select: { firstName: true, lastName: true } } },
      orderBy: { expiresOn: "asc" },
    });
    return textResult(`${certs.length} certificates expiring in next ${days} days.`, certs);
  },
});

export const complianceTools: Tool[] = [listExpiring as unknown as Tool];
