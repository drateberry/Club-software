import { NextResponse } from "next/server";
import Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";
import { markInstallmentPaid, markInvoicePaid } from "@/lib/payments/installments";
import {
  syncAttachedPaymentMethod,
  syncDetachedPaymentMethod,
} from "@/lib/payments/portal";

let stripeClient: Stripe | null = null;
function client(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const provider = getPaymentProvider();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let processed: Awaited<ReturnType<typeof provider.parseWebhook>>;
  try {
    processed = await provider.parseWebhook(body, signature);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return new NextResponse("invalid", { status: 400 });
  }

  const existing = await prisma.webhookEvent.findUnique({
    where: {
      providerName_providerEventId: {
        providerName: provider.name,
        providerEventId: processed.providerEventId,
      },
    },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const stored =
    existing ??
    (await prisma.webhookEvent.create({
      data: {
        providerName: provider.name,
        providerEventId: processed.providerEventId,
        rawJson: processed.raw as Prisma.InputJsonValue,
      },
    }));

  if (processed.match.kind === "installment") {
    await markInstallmentPaid({
      installmentId: processed.match.installmentId,
      amountCents: processed.match.amountCents,
      method: processed.match.method,
      providerName: provider.name,
      providerPaymentId: stored.providerEventId,
    });
  } else if (processed.match.kind === "invoice") {
    await markInvoicePaid({
      invoiceId: processed.match.invoiceId,
      amountCents: processed.match.amountCents,
      method: processed.match.method,
      providerName: provider.name,
      providerPaymentId: stored.providerEventId,
    });
  } else if (processed.match.kind === "event_ticket") {
    await prisma.eventAttendance.update({
      where: { id: processed.match.attendanceId },
      data: { ticketPaidAt: new Date() },
    });
  } else if (processed.match.kind === "payment_method_saved") {
    const m = processed.match;
    const existingMethods = await prisma.savedPaymentMethod.count({
      where: { memberId: m.memberId },
    });
    await prisma.savedPaymentMethod.upsert({
      where: { stripePaymentMethodId: m.stripePaymentMethodId },
      create: {
        memberId: m.memberId,
        stripePaymentMethodId: m.stripePaymentMethodId,
        kind: m.paymentMethodKind,
        brand: m.brand,
        last4: m.last4,
        expMonth: m.expMonth,
        expYear: m.expYear,
        isDefault: existingMethods === 0,
      },
      update: {
        brand: m.brand,
        last4: m.last4,
        expMonth: m.expMonth,
        expYear: m.expYear,
      },
    });
  } else if (processed.match.kind === "payment_method_attached") {
    const pm = await client().paymentMethods.retrieve(processed.match.paymentMethodId);
    await syncAttachedPaymentMethod({
      customerId: processed.match.customerId,
      paymentMethod: pm,
    });
  } else if (processed.match.kind === "payment_method_detached") {
    await syncDetachedPaymentMethod(processed.match.paymentMethodId);
  } else if (processed.match.kind === "refund_processed") {
    const m = processed.match;
    const payment = m.paymentIntentId
      ? await prisma.payment.findUnique({ where: { providerPaymentId: m.paymentIntentId } })
      : null;
    if (payment) {
      await prisma.refund.upsert({
        where: { providerRefundId: m.providerRefundId },
        create: {
          paymentId: payment.id,
          amountCents: m.amountCents,
          currency: payment.currency,
          providerName: "stripe",
          providerRefundId: m.providerRefundId,
          status: m.status,
        },
        update: { status: m.status },
      });
      if (m.status === "succeeded") {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "REFUNDED" },
        });
        if (payment.invoiceId) {
          await prisma.invoice.update({
            where: { id: payment.invoiceId },
            data: { status: "REFUNDED" },
          });
        }
      }
    }
  }

  await prisma.webhookEvent.update({
    where: { id: stored.id },
    data: { processedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
