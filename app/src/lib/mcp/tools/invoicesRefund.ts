import { z } from "zod";
import { refundInvoice } from "@/lib/payments/refunds";
import { logAudit } from "@/lib/audit";
import { makeTool, textResult, errorResult, type Tool } from "../types";

const refundTool = makeTool({
  name: "invoices.refund",
  description: "Refund all SUCCEEDED Stripe payments on a PAID invoice. v1: full-invoice only — no partial refunds, no per-installment.",
  required: ["payments.chargeOnFile"],
  inputSchema: z.object({
    invoiceId: z.string().min(1),
    reason: z.string().max(200).optional(),
  }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot issue refunds");
    try {
      const result = await refundInvoice({
        invoiceId: input.invoiceId,
        reason: input.reason,
        actorUserId: ctx.user.id,
      });
      await logAudit(ctx.user.id, "invoice.void", "Invoice", input.invoiceId, {
        action: "refund",
        source: "mcp",
        ...result,
      });
      return textResult(
        `Refunded $${(result.refundedCents / 100).toFixed(2)} (${result.refundIds.length} refund(s)).`,
        result
      );
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
});

export const invoiceRefundTools: Tool[] = [refundTool as unknown as Tool];
