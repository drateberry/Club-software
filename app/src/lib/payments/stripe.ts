import Stripe from "stripe";
import type {
  CreatePaymentLinkArgs,
  CreatePaymentLinkResult,
  PaymentProvider,
  ProcessedWebhook,
  WebhookMatch,
} from "./provider";

let stripeClient: Stripe | null = null;

function client(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

function methodFromPaymentMethodTypes(
  types: string[] | null | undefined
): "CARD" | "ACH" | "OTHER" {
  if (!types || types.length === 0) return "OTHER";
  if (types.includes("us_bank_account")) return "ACH";
  if (types.includes("card")) return "CARD";
  return "OTHER";
}

export const StripeProvider: PaymentProvider = {
  name: "stripe",

  async createPaymentLink(args: CreatePaymentLinkArgs): Promise<CreatePaymentLinkResult> {
    const stripe = client();
    const paymentMethodTypes = (
      args.enableAch ? ["card", "us_bank_account"] : ["card"]
    ) as Stripe.Checkout.SessionCreateParams["payment_method_types"];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          price_data: {
            currency: args.currency.toLowerCase(),
            product_data: { name: args.description },
            unit_amount: args.amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: args.metadata,
      customer_email: args.customerEmail,
    });

    return {
      providerPaymentId: session.id,
      url: session.url ?? "",
    };
  },

  async parseWebhook(body: string, signatureHeader: string | null): Promise<ProcessedWebhook> {
    const stripe = client();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    if (!signatureHeader) throw new Error("Missing Stripe-Signature header");

    const event = stripe.webhooks.constructEvent(body, signatureHeader, secret);
    const raw = JSON.parse(JSON.stringify(event));
    const ignored = (): ProcessedWebhook => ({
      providerEventId: event.id,
      match: { kind: "ignored" },
      raw,
    });

    if (event.type === "setup_intent.succeeded") {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      const memberId = (setupIntent.metadata ?? {}).memberId;
      const pmId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id ?? null;
      if (!memberId || !pmId) return ignored();

      const pm = await stripe.paymentMethods.retrieve(pmId);
      const card = pm.card;
      const usBank = pm.us_bank_account;
      const match: WebhookMatch = {
        kind: "payment_method_saved",
        memberId,
        stripePaymentMethodId: pm.id,
        brand: card?.brand ?? (usBank ? "us_bank_account" : null),
        last4: card?.last4 ?? usBank?.last4 ?? "",
        expMonth: card?.exp_month ?? null,
        expYear: card?.exp_year ?? null,
        paymentMethodKind: usBank ? "ACH" : "CARD",
      };
      return { providerEventId: event.id, match, raw };
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const meta = intent.metadata ?? {};
      const method = methodFromPaymentMethodTypes(intent.payment_method_types);
      const amountCents = intent.amount_received ?? intent.amount ?? 0;

      let match: WebhookMatch = { kind: "ignored" };
      if (meta.installmentId) {
        match = {
          kind: "installment",
          installmentId: meta.installmentId,
          paid: true,
          amountCents,
          method,
        };
      } else if (meta.invoiceId) {
        match = {
          kind: "invoice",
          invoiceId: meta.invoiceId,
          paid: true,
          amountCents,
          method,
        };
      } else if (meta.attendanceId) {
        match = {
          kind: "event_ticket",
          attendanceId: meta.attendanceId,
          paid: true,
          amountCents,
          method,
        };
      }
      return { providerEventId: event.id, match, raw };
    }

    if (event.type !== "checkout.session.completed") return ignored();

    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") return ignored();

    const meta = session.metadata ?? {};
    const method = methodFromPaymentMethodTypes(session.payment_method_types);
    const amountCents = session.amount_total ?? 0;

    let match: WebhookMatch = { kind: "ignored" };
    if (meta.installmentId) {
      match = {
        kind: "installment",
        installmentId: meta.installmentId,
        paid: true,
        amountCents,
        method,
      };
    } else if (meta.invoiceId) {
      match = {
        kind: "invoice",
        invoiceId: meta.invoiceId,
        paid: true,
        amountCents,
        method,
      };
    } else if (meta.attendanceId) {
      match = {
        kind: "event_ticket",
        attendanceId: meta.attendanceId,
        paid: true,
        amountCents,
        method,
      };
    }

    return { providerEventId: event.id, match, raw };
  },
};
