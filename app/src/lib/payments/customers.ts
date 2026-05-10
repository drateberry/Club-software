import Stripe from "stripe";
import { prisma } from "@/lib/db";

let stripeClient: Stripe | null = null;
function client(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export async function ensureStripeCustomer(memberId: string): Promise<string> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, firstName: true, lastName: true, email: true, stripeCustomerId: true },
  });
  if (!member) throw new Error("Member not found");
  if (member.stripeCustomerId) return member.stripeCustomerId;

  const customer = await client().customers.create({
    name: `${member.firstName} ${member.lastName}`,
    email: member.email ?? undefined,
    metadata: { memberId: member.id },
  });

  await prisma.member.update({
    where: { id: member.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
