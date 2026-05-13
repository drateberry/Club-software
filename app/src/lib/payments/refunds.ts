import Stripe from "stripe";
import { InvoiceStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invoiceChanged } from "@/lib/mcp/events";

let stripeClient: Stripe | null = null;
function client(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export type RefundResult = {
  invoiceId: string;
  refundedCents: number;
  refundIds: string[];
};

/**
 * Refund every SUCCEEDED Payment on the invoice via Stripe (v1: full
 * invoice refund only — no partial-of-installment).
 *
 * The Stripe payment_intent_id is the same as our `Payment.providerPaymentId`
 * (we store the PaymentIntent id, not the charge id). Stripe will resolve
 * the underlying charge and refund it. Each refund persists a Refund row;
 * the existing `charge.refunded` webhook also sets each Payment's status
 * to REFUNDED, so this function is idempotent on retry.
 */
export async function refundInvoice(args: {
  invoiceId: string;
  reason?: string;
  actorUserId: string | null;
}): Promise<RefundResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: args.invoiceId },
    include: { payments: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === InvoiceStatus.REFUNDED) {
    throw new Error("Invoice already refunded");
  }
  if (invoice.status !== InvoiceStatus.PAID) {
    throw new Error("Only PAID invoices can be refunded");
  }

  const eligible = invoice.payments.filter(
    (p) => p.status === PaymentStatus.SUCCEEDED && p.providerName === "stripe"
  );
  if (eligible.length === 0) {
    throw new Error("No refundable payments on this invoice");
  }

  const refundIds: string[] = [];
  let refundedCents = 0;
  for (const payment of eligible) {
    const refund = await client().refunds.create({
      payment_intent: payment.providerPaymentId,
      reason: "requested_by_customer",
      metadata: {
        invoiceId: invoice.id,
        paymentId: payment.id,
        ...(args.reason ? { reason: args.reason } : {}),
      },
    });
    await prisma.refund.upsert({
      where: { providerRefundId: refund.id },
      create: {
        paymentId: payment.id,
        amountCents: refund.amount,
        currency: refund.currency.toUpperCase(),
        reason: args.reason ?? null,
        providerName: "stripe",
        providerRefundId: refund.id,
        status: refund.status ?? "succeeded",
        createdById: args.actorUserId,
      },
      update: { status: refund.status ?? "succeeded" },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REFUNDED },
    });
    refundedCents += refund.amount;
    refundIds.push(refund.id);
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: InvoiceStatus.REFUNDED },
  });

  invoiceChanged(invoice.id);
  return { invoiceId: invoice.id, refundedCents, refundIds };
}
