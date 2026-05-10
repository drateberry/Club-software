import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { sendInvoice, voidInvoice } from "../actions";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCapability("finance.read");
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      member: true,
      lines: true,
      installments: { orderBy: { sequence: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!invoice) notFound();

  const canWrite = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "finance.write"
  );
  const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
  const publicUrl = `${baseUrl}/pay/${invoice.paymentToken}`;
  const send = sendInvoice.bind(null, invoice.id);
  const voidIt = voidInvoice.bind(null, invoice.id);

  return (
    <div className="space-y-6">
      <Link href="/finance/invoices" className="text-sm text-gray-600 hover:underline">
        ← Invoices
      </Link>

      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{invoice.number}</h1>
        <span className="rounded bg-gray-100 px-2 py-1 text-xs uppercase text-gray-700">
          {invoice.status}
        </span>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase text-gray-500">Billed to</div>
            <div className="font-medium">
              <Link href={`/members/${invoice.memberId}`} className="hover:underline">
                {invoice.member.firstName} {invoice.member.lastName}
              </Link>
            </div>
            <div className="text-gray-500">{invoice.member.email}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase text-gray-500">Total</div>
            <div className="text-2xl font-semibold">
              {formatMoney(invoice.totalCents, invoice.currency)}
            </div>
            {invoice.dueDate && (
              <div className="text-gray-500">Due {formatDate(invoice.dueDate)}</div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Line items</h2>
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

      {invoice.installments.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Installments</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {invoice.installments.map((inst) => (
              <li key={inst.id} className="flex items-center justify-between py-2">
                <span>
                  #{inst.sequence} — {formatMoney(inst.amountCents + inst.adminFeeCents, invoice.currency)}
                </span>
                <span className="text-gray-500">
                  {inst.status === "PAID"
                    ? `Paid ${formatDate(inst.paidAt)}`
                    : `${inst.status} · due ${formatDate(inst.dueDate)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invoice.payments.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Payments</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>
                  {p.method} — {formatMoney(p.amountCents, p.currency)}
                </span>
                <span className="text-gray-500">{formatDateTime(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Public payment page</h2>
        <p className="break-all rounded bg-gray-50 px-3 py-2 text-xs text-gray-700">
          {publicUrl}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Send this link to the member. The page lets them choose a plan and pay via
          card or ACH.
        </p>
      </section>

      {canWrite && (
        <div className="flex gap-2">
          {invoice.status === "DRAFT" && (
            <form action={send}>
              <button
                type="submit"
                className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Mark as sent
              </button>
            </form>
          )}
          {invoice.status !== "PAID" && invoice.status !== "VOID" && (
            <form action={voidIt}>
              <button
                type="submit"
                className="rounded border border-red-300 px-4 py-2 text-sm text-red-700"
              >
                Void
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
