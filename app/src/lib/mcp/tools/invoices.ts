import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeTool, textResult, type Tool } from "../types";

const listInvoices = makeTool({
  name: "invoices.list",
  description: "List invoices, optionally filtered by status. Member-scoped tokens see only their own invoices.",
  required: ["finance.read"],
  inputSchema: z.object({
    status: z.enum(["DRAFT", "SENT", "PAID", "VOID"]).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async handler(input, ctx) {
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(ctx.user.role === "MEMBER" && ctx.user.memberId
        ? { memberId: ctx.user.memberId }
        : {}),
    };
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      include: { member: { select: { firstName: true, lastName: true } } },
    });
    return textResult(`${invoices.length} invoices.`, invoices);
  },
});

const getInvoice = makeTool({
  name: "invoices.get",
  description: "Fetch a single invoice with line items, installments, and payment history.",
  required: ["finance.read"],
  inputSchema: z.object({ invoiceId: z.string().min(1) }),
  async handler(input, ctx) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      include: {
        member: true,
        lines: true,
        installments: { orderBy: { sequence: "asc" } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!invoice) return textResult("Invoice not found.", null);
    if (ctx.user.role === "MEMBER" && ctx.user.memberId !== invoice.memberId) {
      return textResult("Not found.", null);
    }
    return textResult(invoice.number, invoice);
  },
});

export const invoiceTools: Tool[] = [
  listInvoices as unknown as Tool,
  getInvoice as unknown as Tool,
];
