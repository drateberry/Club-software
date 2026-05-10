"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe as StripeInstance } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { createSetupIntentForMember } from "./actions";

let stripePromise: Promise<StripeInstance | null> | null = null;
function getStripe(publishableKey: string) {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

function CardForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    startTransition(async () => {
      setError(null);
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (result.error) {
        setError(result.error.message ?? "Could not save card");
        return;
      }
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || pending}
        className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save card"}
      </button>
    </form>
  );
}

export function AddCardForm({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await createSetupIntentForMember(memberId);
        if (cancelled) return;
        setClientSecret(result.clientSecret);
        setPublishableKey(result.publishableKey);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, memberId]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
      >
        Add card on file
      </button>
    );
  }

  if (error) {
    return (
      <div className="space-y-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(false);
          }}
          className="text-xs underline"
        >
          Close
        </button>
      </div>
    );
  }

  if (!clientSecret || !publishableKey) {
    return <p className="text-sm text-gray-500">Loading payment form…</p>;
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <Elements stripe={getStripe(publishableKey)} options={{ clientSecret }}>
        <CardForm
          onDone={() => {
            setOpen(false);
            setClientSecret(null);
            router.refresh();
          }}
        />
      </Elements>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="block text-xs text-gray-500 underline"
      >
        Cancel
      </button>
    </div>
  );
}
