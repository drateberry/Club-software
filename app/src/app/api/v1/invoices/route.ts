import { z } from "zod";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api/v1";

export const runtime = "nodejs";

export const GET = withApi({
  scopes: ["finance.read"],
  source: "query",
  inputSchema: z.object({
    status: z.enum(["DRAFT", "SENT", "PAID", "VOID"]).optional(),
    memberId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
  async handler(input, ctx) {
    const memberId =
      ctx.user.role === "MEMBER" && ctx.user.memberId
        ? ctx.user.memberId
        : input.memberId;

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(memberId ? { memberId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      include: {
        member: { select: { firstName: true, lastName: true, memberNumber: true } },
        installments: { orderBy: { sequence: "asc" } },
      },
    });

    return { data: invoices };
  },
});
