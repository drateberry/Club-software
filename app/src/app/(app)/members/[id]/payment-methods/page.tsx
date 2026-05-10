import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate } from "@/lib/format";
import { AddCardForm } from "./AddCardForm";
import {
  deletePaymentMethod,
  setDefaultPaymentMethod,
  openCustomerPortal,
} from "./actions";

export default async function PaymentMethodsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("members.write");
  const { id } = await params;

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      paymentMethods: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!member || member.deletedAt) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href={`/members/${id}`} className="text-sm text-gray-600 hover:underline">
        ← {member.firstName} {member.lastName}
      </Link>
      <h1 className="text-2xl font-semibold">Payment methods on file</h1>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        {member.paymentMethods.length === 0 ? (
          <p className="text-sm text-gray-500">No payment methods saved.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {member.paymentMethods.map((pm) => {
              const remove = deletePaymentMethod.bind(null, member.id, pm.id);
              const setDefault = setDefaultPaymentMethod.bind(null, member.id, pm.id);
              const expiry =
                pm.expMonth && pm.expYear
                  ? `${String(pm.expMonth).padStart(2, "0")}/${String(pm.expYear).slice(-2)}`
                  : null;
              return (
                <li key={pm.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">
                      {pm.brand?.toUpperCase() ?? pm.kind} •••• {pm.last4}
                      {pm.isDefault && (
                        <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] uppercase text-green-900">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {expiry && `Exp ${expiry} · `}Added {formatDate(pm.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!pm.isDefault && (
                      <form action={setDefault}>
                        <SubmitButton variant="secondary">Make default</SubmitButton>
                      </form>
                    )}
                    <form action={remove}>
                      <ConfirmButton
                        message="Remove this payment method?"
                        confirmLabel="Remove"
                        pendingLabel="Removing…"
                      >
                        Remove
                      </ConfirmButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <AddCardForm memberId={member.id} />
        <p className="text-xs text-gray-500">
          Card details are entered into Stripe&apos;s embedded form and never touch
          our servers. We store only the brand, last 4 digits, and expiry.
        </p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          Self-serve in Stripe&apos;s Customer Portal
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          Opens Stripe&apos;s hosted portal in a new session where the member
          can add or remove cards, see receipts, and update their billing
          info. Changes sync back here automatically. (Configure allowed
          features in <em>Stripe → Settings → Billing → Customer portal</em>.)
        </p>
        <form action={openCustomerPortal.bind(null, member.id)}>
          <SubmitButton variant="secondary" pendingLabel="Opening…">
            Open in Stripe Customer Portal
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
