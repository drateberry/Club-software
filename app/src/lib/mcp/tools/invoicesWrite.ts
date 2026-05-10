import { z } from "zod";
import { InvoiceKind, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { makeTool, textResult, errorResult, type Tool } from "../types";

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.invoice.findFirst({
    where: { number: { startsWith: `INV-${year}-` } },
    orderBy: { number: "desc" },
  });
  const seq = last ? Number.parseInt(last.number.split("-").at(-1) ?? "0", 10) + 1 : 1;
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

const createInvoice = makeTool({
  name: "invoices.create",
  description: "Create a draft invoice for a member with line items. Returns the new invoice with paymentToken.",
  required: ["finance.write"],
  inputSchema: z.object({
    memberId: z.string().min(1),
    kind: z.nativeEnum(InvoiceKind).default(InvoiceKind.OTHER),
    dueDate: z.string().optional(),
    lines: z
      .array(
        z.object({
          description: z.string().min(1).max(500),
          quantity: z.number().int().min(1).max(9999).default(1),
          unitCents: z.number().int().min(0).max(100_000_000),
        })
      )
      .min(1),
    notes: z.string().max(2000).optional(),
  }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot create invoices");
    const totalCents = input.lines.reduce(
      (sum, l) => sum + (l.quantity ?? 1) * l.unitCents,
      0
    );
    const number = await nextInvoiceNumber();
    const invoice = await prisma.invoice.create({
      data: {
        number,
        memberId: input.memberId,
        kind: input.kind ?? InvoiceKind.OTHER,
        status: InvoiceStatus.DRAFT,
        currency: process.env.CLUB_CURRENCY ?? "USD",
        totalCents,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        notes: input.notes ?? null,
        lines: {
          create: input.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity ?? 1,
            unitCents: l.unitCents,
            totalCents: (l.quantity ?? 1) * l.unitCents,
            kind: input.kind ?? InvoiceKind.OTHER,
          })),
        },
      },
    });
    await logAudit(ctx.user.id, "invoice.create", "Invoice", invoice.id, { source: "mcp", totalCents });
    return textResult(`Created invoice ${invoice.number}.`, invoice);
  },
});

const sendInvoice = makeTool({
  name: "invoices.send",
  description: "Mark a DRAFT invoice as SENT. Triggers the invoice.sent SMS if enabled.",
  required: ["finance.write"],
  inputSchema: z.object({ invoiceId: z.string().min(1) }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot send invoices");
    const invoice = await prisma.invoice.update({
      where: { id: input.invoiceId },
      data: { status: InvoiceStatus.SENT },
    });
    await logAudit(ctx.user.id, "invoice.send", "Invoice", invoice.id, { source: "mcp" });
    return textResult(`Sent invoice ${invoice.number}.`, invoice);
  },
});

const voidInvoice = makeTool({
  name: "invoices.void",
  description: "Void an invoice.",
  required: ["finance.write"],
  inputSchema: z.object({ invoiceId: z.string().min(1) }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot void invoices");
    await prisma.invoice.update({
      where: { id: input.invoiceId },
      data: { status: InvoiceStatus.VOID },
    });
    await logAudit(ctx.user.id, "invoice.void", "Invoice", input.invoiceId, { source: "mcp" });
    return textResult("Voided.", { invoiceId: input.invoiceId });
  },
});

const chargeOnFileTool = makeTool({
  name: "invoices.charge_on_file",
  description:
    "Charge the member's default saved card for the next unpaid installment, or for the full invoice when there are no installments.",
  required: ["payments.chargeOnFile"],
  inputSchema: z.object({ invoiceId: z.string().min(1) }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot charge cards");
    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      include: { installments: { orderBy: { sequence: "asc" } } },
    });
    if (!invoice) return errorResult("Invoice not found");
    if (invoice.status === InvoiceStatus.PAID) return errorResult("Already paid");
    if (invoice.status === InvoiceStatus.VOID) return errorResult("Invoice is void");

    const next = invoice.installments.find((i) => i.status !== "PAID");
    const amount = next ? next.amountCents + next.adminFeeCents : invoice.totalCents;
    const { chargeOnFile } = await import("@/lib/payments/chargeOnFile");
    const result = await chargeOnFile({
      memberId: invoice.memberId,
      amountCents: amount,
      description: `Invoice ${invoice.number}${next ? ` — installment ${next.sequence}` : ""}`,
      invoiceId: next ? undefined : invoice.id,
      installmentId: next?.id,
    });
    await logAudit(ctx.user.id, "payment.chargeOnFile", "Invoice", invoice.id, {
      source: "mcp",
      amountCents: amount,
      paymentIntentId: result.paymentIntentId,
    });
    return textResult(`Charged $${(amount / 100).toFixed(2)} (status=${result.status}).`, result);
  },
});

const getPaymentLink = makeTool({
  name: "invoices.get_payment_link",
  description: "Get the public payment URL for an invoice. Member-scoped tokens get only their own.",
  required: ["finance.read"],
  inputSchema: z.object({ invoiceId: z.string().min(1) }),
  async handler(input, ctx) {
    const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId } });
    if (!invoice) return errorResult("Invoice not found");
    if (ctx.user.role === "MEMBER" && ctx.user.memberId !== invoice.memberId) {
      return errorResult("Not found");
    }
    const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
    const url = `${baseUrl}/pay/${invoice.paymentToken}`;
    return textResult(url, { url, paymentToken: invoice.paymentToken });
  },
});

export const invoiceWriteTools: Tool[] = [
  createInvoice as unknown as Tool,
  sendInvoice as unknown as Tool,
  voidInvoice as unknown as Tool,
  chargeOnFileTool as unknown as Tool,
  getPaymentLink as unknown as Tool,
];
