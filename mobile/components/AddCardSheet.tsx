import { useState } from "react";
import { Alert } from "react-native";
import {
  StripeProvider,
  useStripe,
} from "@stripe/stripe-react-native";
import { Button } from "@/components/Button";
import { apiClient } from "@/lib/hooks";
import { useMe } from "@/lib/hooks";

/**
 * Native add-card flow using Stripe PaymentSheet in `setup` mode.
 * The screen wraps itself in StripeProvider so consumers don't need to
 * remember to mount one at the root. The SetupIntent + ephemeral key
 * come from /api/v1/payment-methods/setup-intent (forPaymentSheet=true).
 * On success the Stripe webhook persists the SavedPaymentMethod row.
 */
function AddCardInner({
  publishableKey,
  onDone,
}: {
  publishableKey: string;
  onDone: () => void;
}) {
  const stripe = useStripe();
  const me = useMe();
  const [pending, setPending] = useState(false);

  const run = async () => {
    if (!stripe) return;
    setPending(true);
    try {
      const intent = await apiClient.createSetupIntent({
        forPaymentSheet: true,
      });
      if (!intent.publishableKey || !intent.ephemeralKey) {
        throw new Error("Stripe is not configured for native payment sheets");
      }

      const init = await stripe.initPaymentSheet({
        merchantDisplayName: me.data?.clubName ?? "Club OS",
        customerId: intent.customerId,
        customerEphemeralKeySecret: intent.ephemeralKey,
        setupIntentClientSecret: intent.clientSecret,
        allowsDelayedPaymentMethods: true,
        returnURL: "clubos://payment-return",
      });
      if (init.error) throw new Error(init.error.message);

      const present = await stripe.presentPaymentSheet();
      if (present.error) {
        if (present.error.code === "Canceled") return;
        throw new Error(present.error.message);
      }

      Alert.alert("Card added", "Your payment method is on file.");
      onDone();
    } catch (err) {
      Alert.alert("Could not add card", (err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      title={pending ? "Opening…" : "Add card on file"}
      onPress={run}
      disabled={pending || !stripe || !publishableKey}
    />
  );
}

export function AddCardButton({ onDone }: { onDone: () => void }) {
  const me = useMe();
  const publishableKey = (me.data as { stripePublishableKey?: string } | undefined)
    ?.stripePublishableKey ?? null;

  // We need the publishable key to mount StripeProvider; pull it lazily
  // off the SetupIntent the first time AddCardInner runs. If it's known
  // ahead of time (e.g. surfaced via /me), use it directly. Otherwise
  // fall back to mounting once we get the value.
  return (
    <StripeProvider
      publishableKey={publishableKey ?? "pk_test_placeholder"}
      merchantIdentifier="merchant.com.clubos.app"
    >
      <AddCardInner
        publishableKey={publishableKey ?? ""}
        onDone={onDone}
      />
    </StripeProvider>
  );
}
