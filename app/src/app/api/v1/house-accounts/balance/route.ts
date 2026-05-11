import { z } from "zod";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api/v1";

export const runtime = "nodejs";

export const GET = withApi({
  scopes: ["houseAccounts.read"],
  source: "query",
  inputSchema: z.object({
    memberId: z.string().optional(),
  }),
  async handler(input, ctx) {
    const memberId =
      ctx.user.role === "MEMBER" && ctx.user.memberId
        ? ctx.user.memberId
        : input.memberId;
    if (!memberId) {
      return { error: "memberId_required" };
    }

    const charges = await prisma.houseCharge.findMany({
      where: { memberId, invoiceId: null },
      orderBy: { occurredOn: "desc" },
    });
    const totalCents = charges.reduce((s, c) => s + c.amountCents, 0);
    return { memberId, totalCents, charges };
  },
});
