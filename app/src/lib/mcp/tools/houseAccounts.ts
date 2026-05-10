import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeTool, textResult, type Tool } from "../types";

const getBalance = makeTool({
  name: "house_accounts.get_balance",
  description: "Get the unbilled house-account balance for a member (sum of charges with no invoiceId).",
  required: ["houseAccounts.read"],
  inputSchema: z.object({ memberId: z.string().min(1) }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER" && ctx.user.memberId !== input.memberId) {
      return textResult("Not found.", null);
    }
    const charges = await prisma.houseCharge.findMany({
      where: { memberId: input.memberId, invoiceId: null },
      orderBy: { occurredOn: "desc" },
    });
    const totalCents = charges.reduce((s, c) => s + c.amountCents, 0);
    return textResult(`Balance: $${(totalCents / 100).toFixed(2)} across ${charges.length} unbilled charges.`, {
      memberId: input.memberId,
      totalCents,
      charges,
    });
  },
});

const listCharges = makeTool({
  name: "house_accounts.list_charges",
  description: "List recent house charges, optionally for one member. Member-scoped tokens see only their own.",
  required: ["houseAccounts.read"],
  inputSchema: z.object({
    memberId: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async handler(input, ctx) {
    const memberId = ctx.user.role === "MEMBER" && ctx.user.memberId
      ? ctx.user.memberId
      : input.memberId;
    const charges = await prisma.houseCharge.findMany({
      where: memberId ? { memberId } : {},
      orderBy: { occurredOn: "desc" },
      take: input.limit,
      include: { member: { select: { firstName: true, lastName: true } } },
    });
    return textResult(`${charges.length} charges.`, charges);
  },
});

export const houseAccountTools: Tool[] = [
  getBalance as unknown as Tool,
  listCharges as unknown as Tool,
];
