import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { formatDateTime } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { manualCheckin } from "./actions";

export default async function CheckinPage() {
  await requireCapability("checkin.scan");

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const [members, todaysCheckins] = await Promise.all([
    prisma.member.findMany({
      where: { deletedAt: null, membershipStatus: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, memberNumber: true },
    }),
    prisma.checkinLog.findMany({
      where: { scannedAt: { gte: since } },
      include: { member: true },
      orderBy: { scannedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Check-in</h1>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-700">Scan a member pass</h2>
        <p className="mb-3 text-xs text-gray-500">
          Use your phone&apos;s camera (or any QR scanner) on the member&apos;s pass.
          The link opens this device&apos;s confirmation page where you confirm
          the check-in.
        </p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Manual check-in</h2>
        <form action={manualCheckin} className="flex gap-2">
          <select
            name="memberId"
            required
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Find a member…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.lastName}, {m.firstName}
                {m.memberNumber ? ` (#${m.memberNumber})` : ""}
              </option>
            ))}
          </select>
          <SubmitButton pendingLabel="Logging…">Log check-in</SubmitButton>
        </form>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Today&apos;s check-ins ({todaysCheckins.length})
        </h2>
        {todaysCheckins.length === 0 ? (
          <p className="text-sm text-gray-500">No check-ins yet today.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {todaysCheckins.map((log) => (
              <li key={log.id} className="flex justify-between py-2">
                <Link
                  href={`/members/${log.memberId}`}
                  className="hover:underline"
                >
                  {log.member.firstName} {log.member.lastName}
                </Link>
                <span className="text-gray-500">{formatDateTime(log.scannedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
