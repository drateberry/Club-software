import Stripe from "stripe";
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

export async function createSetupIntent(memberId: string): Promise<{
  clientSecret: string;
  customerId: string;
}> {
  const customerId = await ensureStripeCustomer(memberId);
  const intent = await client().setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
    metadata: { memberId },
  });
  if (!intent.client_secret) throw new Error("Stripe did not return a SetupIntent client_secret");
  return { clientSecret: intent.client_secret, customerId };
}
