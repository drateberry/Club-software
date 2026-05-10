import { StripeProvider } from "./stripe";
import type { PaymentProvider } from "./provider";

export function getPaymentProvider(): PaymentProvider {
  return StripeProvider;
}

export type { PaymentProvider } from "./provider";
