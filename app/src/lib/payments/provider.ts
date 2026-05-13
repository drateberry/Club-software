import type { Prisma } from "@prisma/client";

export type CreatePaymentLinkArgs = {
  description: string;
  amountCents: number;
  currency: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  enableAch?: boolean;
  customerEmail?: string;
};

export type CreatePaymentLinkResult = {
  providerPaymentId: string;
  url: string;
};

export type WebhookMatch =
  | { kind: "installment"; installmentId: string; paid: boolean; amountCents: number; method: "CARD" | "ACH" | "OTHER" }
  | { kind: "invoice"; invoiceId: string; paid: boolean; amountCents: number; method: "CARD" | "ACH" | "OTHER" }
  | { kind: "event_ticket"; attendanceId: string; paid: boolean; amountCents: number; method: "CARD" | "ACH" | "OTHER" }
  | {
      kind: "payment_method_saved";
      memberId: string;
      stripePaymentMethodId: string;
      brand: string | null;
      last4: string;
      expMonth: number | null;
      expYear: number | null;
      paymentMethodKind: "CARD" | "ACH";
    }
  | {
      kind: "payment_method_attached";
      customerId: string;
      paymentMethodId: string;
    }
  | {
      kind: "payment_method_detached";
      paymentMethodId: string;
    }
  | {
      kind: "refund_processed";
      providerRefundId: string;
      paymentIntentId: string | null;
      amountCents: number;
      status: string;
    }
  | { kind: "ignored" };

export type ProcessedWebhook = {
  providerEventId: string;
  match: WebhookMatch;
  raw: Prisma.InputJsonValue;
};

export interface PaymentProvider {
  readonly name: string;

  createPaymentLink(args: CreatePaymentLinkArgs): Promise<CreatePaymentLinkResult>;

  /**
   * Verifies signature and returns a normalized event description plus the
   * lookup match. Signature failures throw.
   */
  parseWebhook(body: string, signatureHeader: string | null): Promise<ProcessedWebhook>;
}
