import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { HOUSE_ACCOUNT_CATEGORIES } from "@/lib/houseAccounts";
import { withApi } from "@/lib/api/v1";

export const runtime = "nodejs";

export const POST = withApi({
  scopes: ["houseAccounts.write"],
  source: "json",
  inputSchema: z.object({
    memberId: z.string().min(1),
    category: z.enum(HOUSE_ACCOUNT_CATEGORIES),
    amountCents: z.number().int().min(1).max(10_000_000),
    occurredOn: z.string().optional(),
    memo: z.string().max(500).optional(),
  }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") {
      return { error: "forbidden" };
    }
    const charge = await prisma.houseCharge.create({
      data: {
        memberId: input.memberId,
        category: input.category,
        amountCents: input.amountCents,
        occurredOn: input.occurredOn ? new Date(input.occurredOn) : new Date(),
        memo: input.memo ?? null,
        postedById: ctx.user.id,
      },
    });
    await logAudit(ctx.user.id, "houseCharge.create", "HouseCharge", charge.id, {
      source: "api/v1",
    });
    return charge;
  },
});
