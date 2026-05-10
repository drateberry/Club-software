import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/format";
import { selectPlan, payInstallment } from "./actions";

export default async function PublicPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { token } = await params;
  const { status } = await searchParams;

  const invoice = await prisma.invoice.findUnique({
    where: { paymentToken: token },
    include: {
      member: true,
      lines: true,
      installments: { orderBy: { sequence: "asc" } },
    },
  });
  if (!invoice) notFound();

  const banner =
    status === "success"
      ? "Thank you — your payment is being processed. This page will update once we receive confirmation."
      : status === "cancel"
        ? "Payment cancelled. You can try again below."
        : null;

  const isPaid = invoice.status === "PAID";
  const hasInstallments = invoice.installments.length > 0;
  const nextDue = invoice.installments.find((i) => i.status !== "PAID");

  const selectPlanThis = selectPlan.bind(null, invoice.id);
  const payNext = nextDue ? payInstallment.bind(null, nextDue.id) : null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{process.env.CLUB_NAME ?? "Club"}</h1>
        <p className="text-sm text-gray-600">Invoice {invoice.number}</p>
      </header>

      {banner && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          {banner}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="text-sm text-gray-500">Billed to</div>
            <div className="font-medium">
              {invoice.member.firstName} {invoice.member.lastName}
            </div>
            <div className="text-sm text-gray-500">{invoice.member.email}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-semibold">
              {formatMoney(invoice.totalCents, invoice.currency)}
            </div>
            {invoice.dueDate && (
              <div className="text-sm text-gray-500">
                Due {formatDate(invoice.dueDate)}
              </div>
            )}
          </div>
        </div>

        <ul className="divide-y divide-gray-100 text-sm">
          {invoice.lines.map((line) => (
            <li key={line.id} className="flex justify-between py-2">
              <span>
                {line.description}
                {line.quantity > 1 && (
                  <span className="ml-1 text-gray-500">× {line.quantity}</span>
                )}
              </span>
              <span>{formatMoney(line.totalCents, invoice.currency)}</span>
            </li>
          ))}
        </ul>
      </section>

      {isPaid ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          This invoice is paid in full. Thank you.
        </div>
      ) : !hasInstallments ? (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Choose a payment plan</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <form action={selectPlanThis}>
              <input type="hidden" name="plan" value="full" />
              <button
                type="submit"
                className="w-full rounded border border-gray-300 p-3 text-left hover:bg-gray-50"
              >
                <div className="font-medium">Pay in full</div>
                <div className="text-xs text-gray-500">
                  {formatMoney(invoice.totalCents, invoice.currency)}
                </div>
              </button>
            </form>
            <form action={selectPlanThis}>
              <input type="hidden" name="plan" value="quarterly_3" />
              <button
                type="submit"
                className="w-full rounded border border-gray-300 p-3 text-left hover:bg-gray-50"
              >
                <div className="font-medium">3 quarterly installments</div>
                <div className="text-xs text-gray-500">
                  {formatMoney(Math.ceil(invoice.totalCents / 3), invoice.currency)} each
                </div>
              </button>
            </form>
            <form action={selectPlanThis}>
              <input type="hidden" name="plan" value="monthly_8" />
              <button
                type="submit"
                className="w-full rounded border border-gray-300 p-3 text-left hover:bg-gray-50"
              >
                <div className="font-medium">8 monthly installments</div>
                <div className="text-xs text-gray-500">
                  {formatMoney(Math.ceil(invoice.totalCents / 8), invoice.currency)} each
                </div>
              </button>
            </form>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Installments</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {invoice.installments.map((inst) => (
              <li key={inst.id} className="flex items-center justify-between py-2">
                <span>
                  #{inst.sequence} — {formatMoney(inst.amountCents + inst.adminFeeCents, invoice.currency)}
                </span>
                <span className="text-gray-500">
                  {inst.status === "PAID"
                    ? `Paid ${formatDate(inst.paidAt)}`
                    : `Due ${formatDate(inst.dueDate)}`}
                </span>
              </li>
            ))}
          </ul>
          {nextDue && payNext && (
            <form action={payNext} className="mt-4">
              <button
                type="submit"
                className="w-full rounded bg-black py-2 text-sm font-medium text-white"
              >
                Pay {formatMoney(nextDue.amountCents + nextDue.adminFeeCents, invoice.currency)} now
              </button>
              <p className="mt-2 text-center text-xs text-gray-500">
                You&apos;ll be redirected to Stripe. Pay by card or ACH bank transfer.
              </p>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
