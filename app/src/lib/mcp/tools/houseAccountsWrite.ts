import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  HOUSE_ACCOUNT_CATEGORIES,
  generateStatements,
  startOfMonth,
  startOfNextMonth,
} from "@/lib/houseAccounts";
import { makeTool, textResult, errorResult, type Tool } from "../types";

const addCharge = makeTool({
  name: "house_accounts.add_charge",
  description:
    "Post a charge to a member's house account. Categories: " + HOUSE_ACCOUNT_CATEGORIES.join(", "),
  required: ["houseAccounts.write"],
  inputSchema: z.object({
    memberId: z.string().min(1),
    category: z.enum(HOUSE_ACCOUNT_CATEGORIES),
    amountCents: z.number().int().min(1).max(10_000_000),
    occurredOn: z.string().optional(),
    memo: z.string().max(500).optional(),
  }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot post charges");
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
    await logAudit(ctx.user.id, "houseCharge.create", "HouseCharge", charge.id, { source: "mcp" });
    return textResult(`Posted $${(input.amountCents / 100).toFixed(2)} ${input.category} charge.`, charge);
  },
});

const deleteCharge = makeTool({
  name: "house_accounts.delete_charge",
  description: "Delete an unbilled house charge.",
  required: ["houseAccounts.write"],
  inputSchema: z.object({ chargeId: z.string().min(1) }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot delete charges");
    await prisma.houseCharge.delete({ where: { id: input.chargeId } });
    await logAudit(ctx.user.id, "houseCharge.delete", "HouseCharge", input.chargeId, { source: "mcp" });
    return textResult("Deleted.", { chargeId: input.chargeId });
  },
});

const runMonthlyStatements = makeTool({
  name: "house_accounts.run_statements",
  description:
    "Generate the previous calendar month's statements. Idempotent — re-running for the same period skips members already statemented.",
  required: ["houseAccounts.write"],
  inputSchema: z.object({}),
  async handler(_input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot run statements");
    const now = new Date();
    const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const end = startOfNextMonth(start);
    const result = await generateStatements(start, end);
    await logAudit(ctx.user.id, "statement.batchRun", "Statement", `${start.toISOString()}`, {
      source: "mcp",
      ...result,
    });
    return textResult(
      `Generated ${result.created} statement(s); skipped ${result.skipped} (already statemented).`,
      result
    );
  },
});

export const houseAccountsWriteTools: Tool[] = [
  addCharge as unknown as Tool,
  deleteCharge as unknown as Tool,
  runMonthlyStatements as unknown as Tool,
];
