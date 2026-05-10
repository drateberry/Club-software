import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { formatDate, formatMoney } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteCharge } from "../actions";

export default async function MemberHouseAccountPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const session = await requireCapability("houseAccounts.read");
  const { memberId } = await params;

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      houseCharges: {
        orderBy: { occurredOn: "desc" },
        include: { invoice: true },
      },
      statements: {
        orderBy: { periodStart: "desc" },
        include: { invoice: true },
      },
    },
  });
  if (!member || member.deletedAt) notFound();

  const canWrite = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "houseAccounts.write"
  );

  const unbilled = member.houseCharges.filter((c) => !c.invoiceId);
  const billed = member.houseCharges.filter((c) => c.invoiceId);
  const unbilledTotal = unbilled.reduce((s, c) => s + c.amountCents, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/house-accounts"
        className="text-sm text-gray-600 hover:underline"
      >
        ← House Accounts
      </Link>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">
          {member.firstName} {member.lastName}
        </h1>
        <Link
          href={`/members/${member.id}`}
          className="text-sm text-gray-500 hover:underline"
        >
          Member profile →
        </Link>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-sm text-gray-500">Unbilled balance</div>
            <div className="text-2xl font-semibold">
              {formatMoney(unbilledTotal)}
            </div>
          </div>
          {canWrite && (
            <Link
              href="/house-accounts/charge"
              className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
            >
              Add charge
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Unbilled charges ({unbilled.length})
        </h2>
        {unbilled.length === 0 ? (
          <p className="text-sm text-gray-500">No unbilled charges.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {unbilled.map((c) => {
              const del = deleteCharge.bind(null, c.id, member.id);
              return (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <div>
                    <div>
                      {c.category}
                      {c.memo && <span className="ml-1 text-gray-500">— {c.memo}</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(c.occurredOn)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatMoney(c.amountCents)}</span>
                    {canWrite && (
                      <form action={del}>
                        <ConfirmButton
                          message="Delete this charge?"
                          confirmLabel="Delete"
                          pendingLabel="Deleting…"
                        >
                          Delete
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Statements ({member.statements.length})
        </h2>
        {member.statements.length === 0 ? (
          <p className="text-sm text-gray-500">No statements yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {member.statements.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <div>
                  <Link
                    href={`/finance/invoices/${s.invoiceId}`}
                    className="hover:underline"
                  >
                    {s.invoice.number}
                  </Link>
                  <span className="ml-2 text-xs text-gray-500">
                    {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
                  </span>
                </div>
                <span className={s.invoice.status === "PAID" ? "text-green-700" : "text-gray-700"}>
                  {formatMoney(s.invoice.totalCents)} · {s.invoice.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {billed.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Billed history ({billed.length})
          </h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {billed.slice(0, 50).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <div>{c.category}{c.memo && <span className="ml-1 text-gray-500">— {c.memo}</span>}</div>
                  <div className="text-xs text-gray-500">{formatDate(c.occurredOn)}</div>
                </div>
                <span>{formatMoney(c.amountCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
