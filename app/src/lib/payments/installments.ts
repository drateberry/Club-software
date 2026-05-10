import { InstallmentStatus, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "./index";
import { enqueueTriggered } from "@/lib/twilio/triggers";
import { formatMoney } from "@/lib/format";

export type InstallmentPlan = "full" | "quarterly_3" | "monthly_8";

const PLAN_COUNT: Record<InstallmentPlan, number> = {
  full: 1,
  quarterly_3: 3,
  monthly_8: 8,
};

const PLAN_INTERVAL_MONTHS: Record<InstallmentPlan, number> = {
  full: 0,
  quarterly_3: 3,
  monthly_8: 1,
};

function distributeAmount(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export async function applyInstallmentPlan(invoiceId: string, plan: InstallmentPlan) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { installments: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.installments.some((i) => i.status === InstallmentStatus.PAID)) {
    throw new Error("Invoice already has paid installments");
  }

  const count = PLAN_COUNT[plan];
  const amounts = distributeAmount(invoice.totalCents, count);
  const start = invoice.dueDate ?? new Date();

  await prisma.$transaction([
    prisma.installment.deleteMany({ where: { invoiceId, status: { not: InstallmentStatus.PAID } } }),
    prisma.installment.createMany({
      data: amounts.map((amount, i) => ({
        invoiceId,
        sequence: i + 1,
        amountCents: amount,
        adminFeeCents: 0,
        dueDate: addMonths(start, i * PLAN_INTERVAL_MONTHS[plan]),
        status: InstallmentStatus.PENDING,
      })),
    }),
  ]);
}

export async function ensureInstallmentPaymentLink(installmentId: string) {
  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    include: { invoice: { include: { member: true } } },
  });
  if (!installment) throw new Error("Installment not found");
  if (installment.paymentLinkUrl && installment.providerPaymentId) {
    return { url: installment.paymentLinkUrl, providerPaymentId: installment.providerPaymentId };
  }

  const provider = getPaymentProvider();
  const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
  const total = installment.amountCents + installment.adminFeeCents;

  const result = await provider.createPaymentLink({
    description: `Invoice ${installment.invoice.number} — Installment ${installment.sequence}/${(await countSiblings(installment.invoiceId))}`,
    amountCents: total,
    currency: installment.invoice.currency,
    metadata: {
      installmentId: installment.id,
      invoiceId: installment.invoiceId,
    },
    successUrl: `${baseUrl}/pay/${installment.invoice.paymentToken}?status=success`,
    cancelUrl: `${baseUrl}/pay/${installment.invoice.paymentToken}?status=cancel`,
    enableAch: true,
    customerEmail: installment.invoice.member.email ?? undefined,
  });

  await prisma.installment.update({
    where: { id: installment.id },
    data: {
      providerName: provider.name,
      providerPaymentId: result.providerPaymentId,
      paymentLinkUrl: result.url,
      status: InstallmentStatus.SENT,
      sentAt: new Date(),
    },
  });

  return result;
}

async function countSiblings(invoiceId: string) {
  return prisma.installment.count({ where: { invoiceId } });
}

/**
 * Marks an installment paid (idempotent), records the Payment row, and either
 * marks the invoice paid (last installment) or queues the next installment.
 */
export async function markInstallmentPaid(args: {
  installmentId: string;
  amountCents: number;
  method: "CARD" | "ACH" | "OTHER";
  providerName: string;
  providerPaymentId: string;
}) {
  const installment = await prisma.installment.findUnique({
    where: { id: args.installmentId },
    include: { invoice: { include: { installments: true } } },
  });
  if (!installment) return null;
  if (installment.status === InstallmentStatus.PAID) return installment;

  const allOthers = installment.invoice.installments.filter(
    (i) => i.id !== installment.id
  );
  const willBeAllPaid = allOthers.every((i) => i.status === InstallmentStatus.PAID);

  await prisma.$transaction([
    prisma.installment.update({
      where: { id: installment.id },
      data: {
        status: InstallmentStatus.PAID,
        paidAt: new Date(),
      },
    }),
    prisma.payment.upsert({
      where: { providerPaymentId: args.providerPaymentId },
      create: {
        invoiceId: installment.invoiceId,
        providerName: args.providerName,
        providerPaymentId: args.providerPaymentId,
        amountCents: args.amountCents,
        currency: installment.invoice.currency,
        method: args.method,
        status: "SUCCEEDED",
      },
      update: { status: "SUCCEEDED" },
    }),
    ...(willBeAllPaid
      ? [
          prisma.invoice.update({
            where: { id: installment.invoiceId },
            data: { status: InvoiceStatus.PAID, paidAt: new Date() },
          }),
        ]
      : []),
  ]);

  await enqueueTriggered("payment.received", {
    memberId: installment.invoice.memberId,
    vars: {
      invoice_number: installment.invoice.number,
      amount: formatMoney(args.amountCents, installment.invoice.currency),
    },
  });

  return prisma.installment.findUnique({ where: { id: installment.id } });
}

export async function markInvoicePaid(args: {
  invoiceId: string;
  amountCents: number;
  method: "CARD" | "ACH" | "OTHER";
  providerName: string;
  providerPaymentId: string;
}) {
  const invoice = await prisma.invoice.findUnique({ where: { id: args.invoiceId } });
  if (!invoice) return null;
  if (invoice.status === InvoiceStatus.PAID) return invoice;

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: args.invoiceId },
      data: { status: InvoiceStatus.PAID, paidAt: new Date() },
    }),
    prisma.payment.upsert({
      where: { providerPaymentId: args.providerPaymentId },
      create: {
        invoiceId: args.invoiceId,
        providerName: args.providerName,
        providerPaymentId: args.providerPaymentId,
        amountCents: args.amountCents,
        currency: invoice.currency,
        method: args.method,
        status: "SUCCEEDED",
      },
      update: { status: "SUCCEEDED" },
    }),
  ]);

  await enqueueTriggered("payment.received", {
    memberId: invoice.memberId,
    vars: {
      invoice_number: invoice.number,
      amount: formatMoney(args.amountCents, invoice.currency),
    },
  });

  return prisma.invoice.findUnique({ where: { id: args.invoiceId } });
}
