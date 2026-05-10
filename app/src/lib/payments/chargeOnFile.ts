import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { ensureStripeCustomer } from "./customers";
import { markInvoicePaid, markInstallmentPaid } from "./installments";

let stripeClient: Stripe | null = null;
function client(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export type ChargeOnFileArgs = {
  memberId: string;
  amountCents: number;
  description: string;
  invoiceId?: string;
  installmentId?: string;
  paymentMethodId?: string;
};

export type ChargeOnFileResult = {
  paymentIntentId: string;
  status: Stripe.PaymentIntent.Status;
};

export async function chargeOnFile(args: ChargeOnFileArgs): Promise<ChargeOnFileResult> {
  if (!Number.isFinite(args.amountCents) || args.amountCents <= 0) {
    throw new Error("amountCents must be positive");
  }
  const customerId = await ensureStripeCustomer(args.memberId);

  let paymentMethodId = args.paymentMethodId;
  if (!paymentMethodId) {
    const def = await prisma.savedPaymentMethod.findFirst({
      where: { memberId: args.memberId, isDefault: true },
      orderBy: { createdAt: "desc" },
    });
    if (!def) {
      throw new Error("Member has no default payment method on file");
    }
    paymentMethodId = def.stripePaymentMethodId;
  }

  const currency =
    (process.env.CLUB_CURRENCY ?? "USD").toLowerCase();

  const intent = await client().paymentIntents.create({
    amount: args.amountCents,
    currency,
    customer: customerId,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    description: args.description,
    metadata: {
      memberId: args.memberId,
      ...(args.invoiceId ? { invoiceId: args.invoiceId } : {}),
      ...(args.installmentId ? { installmentId: args.installmentId } : {}),
      cardOnFile: "true",
    },
  });

  // Synchronously mark paid so the UI updates immediately. The webhook will
  // also fire as a backup; markInvoicePaid / markInstallmentPaid are
  // idempotent via the unique index on Payment.providerPaymentId.
  if (intent.status === "succeeded") {
    if (args.installmentId) {
      await markInstallmentPaid({
        installmentId: args.installmentId,
        amountCents: args.amountCents,
        method: "CARD",
        providerName: "stripe",
        providerPaymentId: intent.id,
      });
    } else if (args.invoiceId) {
      await markInvoicePaid({
        invoiceId: args.invoiceId,
        amountCents: args.amountCents,
        method: "CARD",
        providerName: "stripe",
        providerPaymentId: intent.id,
      });
    }
  }

  return { paymentIntentId: intent.id, status: intent.status };
}
