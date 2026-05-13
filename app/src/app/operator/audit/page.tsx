import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/guards";
import { formatDateTime } from "@/lib/format";

export default async function OperatorAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string; action?: string }>;
}) {
  await requireOperator();
  const { clubId, action } = await searchParams;

  const events = await prisma.auditEvent.findMany({
    where: {
      ...(clubId ? { clubId } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      actor: { select: { email: true, name: true, role: true } },
      club: { select: { id: true, slug: true, name: true } },
    },
  });

  const clubs = await prisma.club.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Cross-club audit log</h1>
        <p className="text-xs text-gray-500">Last 500 events across every tenant.</p>
      </header>

      <form action="/operator/audit" method="get" className="flex flex-wrap gap-2 text-sm">
        <select
          name="clubId"
          defaultValue={clubId ?? ""}
          className="rounded border border-gray-300 bg-white px-3 py-2"
        >
          <option value="">All clubs</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.slug})
            </option>
          ))}
        </select>
        <input
          type="text"
          name="action"
          placeholder="action contains…"
          defaultValue={action ?? ""}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
        >
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Club</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No events match.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="align-top hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">
                    {formatDateTime(e.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {e.club ? (
                      <code className="rounded bg-gray-100 px-1 py-0.5">{e.club.slug}</code>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {e.actor?.email ?? "—"}
                    {e.actor?.role && (
                      <span className="ml-1 text-gray-400">{e.actor.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {e.entity}{" "}
                    <span className="text-gray-400">{e.entityId.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {e.diffJson ? JSON.stringify(e.diffJson).slice(0, 120) : ""}
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
