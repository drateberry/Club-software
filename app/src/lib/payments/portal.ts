import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { ensureStripeCustomer } from "./customers";

let stripeClient: Stripe | null = null;
function client(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

/**
 * Create a Stripe Customer Portal session for the given member. The Portal
 * is Stripe-hosted; members manage their own saved payment methods, view
 * receipts, and update billing info there. Configure allowed features in
 * the Stripe Dashboard (Settings → Billing → Customer Portal).
 *
 * Throws if the Stripe Customer Portal is not configured for the account.
 */
export async function createCustomerPortalSession(args: {
  memberId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const customerId = await ensureStripeCustomer(args.memberId);
  const session = await client().billingPortal.sessions.create({
    customer: customerId,
    return_url: args.returnUrl,
  });
  return { url: session.url };
}

/**
 * Mirror Stripe's payment_method.attached / payment_method.detached events
 * into our SavedPaymentMethod table so the UI stays in sync when members
 * use the Customer Portal directly.
 */
export async function syncAttachedPaymentMethod(payload: {
  customerId: string;
  paymentMethod: Stripe.PaymentMethod;
}): Promise<void> {
  const member = await prisma.member.findUnique({
    where: { stripeCustomerId: payload.customerId },
    select: { id: true },
  });
  if (!member) return;

  const card = payload.paymentMethod.card;
  const usBank = payload.paymentMethod.us_bank_account;
  if (!card && !usBank) return;

  const existingCount = await prisma.savedPaymentMethod.count({
    where: { memberId: member.id },
  });
  await prisma.savedPaymentMethod.upsert({
    where: { stripePaymentMethodId: payload.paymentMethod.id },
    create: {
      memberId: member.id,
      stripePaymentMethodId: payload.paymentMethod.id,
      kind: usBank ? "ACH" : "CARD",
      brand: card?.brand ?? (usBank ? "us_bank_account" : null),
      last4: card?.last4 ?? usBank?.last4 ?? "",
      expMonth: card?.exp_month ?? null,
      expYear: card?.exp_year ?? null,
      isDefault: existingCount === 0,
    },
    update: {
      brand: card?.brand ?? (usBank ? "us_bank_account" : null),
      last4: card?.last4 ?? usBank?.last4 ?? "",
      expMonth: card?.exp_month ?? null,
      expYear: card?.exp_year ?? null,
    },
  });
}

export async function syncDetachedPaymentMethod(paymentMethodId: string): Promise<void> {
  const existing = await prisma.savedPaymentMethod.findUnique({
    where: { stripePaymentMethodId: paymentMethodId },
  });
  if (!existing) return;

  await prisma.savedPaymentMethod.delete({
    where: { stripePaymentMethodId: paymentMethodId },
  });

  // If the detached method was the default, promote the most recently
  // added remaining method to default so charge-on-file keeps working.
  if (existing.isDefault) {
    const next = await prisma.savedPaymentMethod.findFirst({
      where: { memberId: existing.memberId },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await prisma.savedPaymentMethod.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
}
