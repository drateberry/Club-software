import Stripe from "stripe";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api/v1";
import { createSetupIntent } from "@/lib/payments/setupIntent";
import { ensureStripeCustomer } from "@/lib/payments/customers";

export const runtime = "nodejs";

let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export const POST = withApi({
  scopes: ["finance.read"],
  source: "json",
  inputSchema: z.object({
    memberId: z.string().optional(),
    /** Set true when called from a native client that needs ephemeralKey
     *  to drive Stripe PaymentSheet. */
    forPaymentSheet: z.boolean().optional(),
  }),
  async handler(input, ctx) {
    const memberId =
      ctx.user.role === "MEMBER" && ctx.user.memberId
        ? ctx.user.memberId
        : input.memberId;
    if (!memberId) return { error: "memberId_required" };

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { user: { select: { id: true } } },
    });
    if (
      ctx.user.role !== "ADMIN" &&
      ctx.user.role !== "STAFF" &&
      member?.user?.id !== ctx.user.id
    ) {
      return { error: "forbidden" };
    }

    const customerId = await ensureStripeCustomer(memberId);
    const { clientSecret } = await createSetupIntent(memberId);

    let ephemeralKey: string | null = null;
    if (input.forPaymentSheet) {
      // Stripe API version pinned for ephemeral key issuance — required
      // to match the version expected by the mobile SDK.
      const ek = await stripe().ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: "2024-06-20" }
      );
      ephemeralKey = ek.secret ?? null;
    }

    return {
      clientSecret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
      customerId,
      ephemeralKey,
    };
  },
});
