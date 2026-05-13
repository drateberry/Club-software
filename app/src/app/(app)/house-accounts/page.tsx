import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { formatMoney } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { runMonthlyStatements } from "./actions";

export default async function HouseAccountsPage() {
  const session = await requireCapability("houseAccounts.read");

  const totals = await prisma.houseCharge.groupBy({
    by: ["memberId"],
    _sum: { amountCents: true },
    _count: { _all: true },
    where: { invoiceId: null },
    orderBy: { _sum: { amountCents: "desc" } },
    take: 100,
  });

  const memberIds = totals.map((t) => t.memberId);
  const members = await prisma.member.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, firstName: true, lastName: true, memberNumber: true },
  });
  const memberById = new Map(members.map((m) => [m.id, m]));

  const totalUnbilledCents = totals.reduce(
    (sum, t) => sum + (t._sum.amountCents ?? 0),
    0
  );

  const canWrite = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "houseAccounts.write"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">House Accounts</h1>
        <div className="flex gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/v1/exports/house-charges"
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            Export CSV
          </a>
          {canWrite && (
            <Link
              href="/house-accounts/charge"
              className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
            >
              Add charge
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">Unbilled charges</div>
          <div className="mt-1 text-2xl font-semibold">
            {formatMoney(totalUnbilledCents)}
          </div>
          <div className="text-xs text-gray-500">
            across {totals.length} member{totals.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {canWrite && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">
            Generate last month&apos;s statements
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Aggregates all unbilled charges in the previous calendar month into
            one invoice per member (kind = STATEMENT) and emails the public
            payment link. Idempotent — running twice for the same period skips
            members who already have a statement.
          </p>
          <form action={runMonthlyStatements}>
            <ConfirmButton
              message="Generate statements for the previous calendar month? This creates invoices and is reversible only by voiding them individually."
              confirmLabel="Generate"
              pendingLabel="Generating…"
              variant="primary"
            >
              Run statement batch
            </ConfirmButton>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Members with unbilled charges
        </h2>
        {totals.length === 0 ? (
          <p className="text-sm text-gray-500">No unbilled charges right now.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Member</th>
                  <th className="px-4 py-2 text-right">Charges</th>
                  <th className="px-4 py-2 text-right">Unbilled total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {totals.map((t) => {
                  const member = memberById.get(t.memberId);
                  if (!member) return null;
                  return (
                    <tr key={t.memberId} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <Link
                          href={`/house-accounts/${t.memberId}`}
                          className="hover:underline"
                        >
                          {member.firstName} {member.lastName}
                        </Link>
                        {member.memberNumber && (
                          <span className="ml-2 text-xs text-gray-500">
                            #{member.memberNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">
                        {t._count._all}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatMoney(t._sum.amountCents ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
