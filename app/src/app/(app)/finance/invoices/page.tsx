import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { formatDate, formatMoney } from "@/lib/format";

const STATUS_FILTERS: Array<InvoiceStatus | "ALL"> = [
  "ALL",
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.PAID,
  InvoiceStatus.VOID,
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireCapability("finance.read");
  const t = await getTranslations();
  const { status = "ALL" } = await searchParams;

  const where =
    status === "ALL"
      ? {}
      : { status: status as InvoiceStatus };

  const [invoices, totals] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { member: { select: { firstName: true, lastName: true } } },
      take: 100,
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
  ]);

  const totalsByStatus = Object.fromEntries(
    totals.map((t) => [t.status, { count: t._count._all, sum: t._sum.totalCents ?? 0 }])
  );

  const canWrite = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "finance.write"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("nav.invoices")}</h1>
        <div className="flex gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/v1/exports/invoices"
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            Export CSV
          </a>
        {canWrite && (
          <Link
            href="/finance/invoices/new"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
          >
            New invoice
          </Link>
        )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["DRAFT", "SENT", "PAID", "VOID"] as const).map((s) => (
          <div key={s} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div className="text-xs uppercase text-gray-500">{s}</div>
            <div className="mt-1 text-lg font-semibold">
              {formatMoney(totalsByStatus[s]?.sum ?? 0)}
            </div>
            <div className="text-xs text-gray-500">
              {totalsByStatus[s]?.count ?? 0} invoices
            </div>
          </div>
        ))}
      </div>

      <nav className="flex gap-2 text-sm">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={`/finance/invoices${s === "ALL" ? "" : `?status=${s}`}`}
            className={`rounded border px-3 py-1 ${
              status === s
                ? "border-black bg-black text-white"
                : "border-gray-300 bg-white"
            }`}
          >
            {s}
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Number</th>
              <th className="px-4 py-2">Member</th>
              <th className="px-4 py-2">Kind</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Due</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No invoices.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/finance/invoices/${inv.id}`}
                      className="hover:underline"
                    >
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {inv.member.firstName} {inv.member.lastName}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{inv.kind}</td>
                  <td className="px-4 py-2 text-gray-600">{inv.status}</td>
                  <td className="px-4 py-2 text-gray-500">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-2 text-right">
                    {formatMoney(inv.totalCents, inv.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
