import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { formatDateTime } from "@/lib/format";

export default async function AuditPage() {
  await requireCapability("settings.write");

  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { email: true, name: true } } },
  });

  return (
    <div className="space-y-4">
      <Link href="/settings" className="text-sm text-gray-600 hover:underline">
        ← Settings
      </Link>
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <p className="text-sm text-gray-500">
        Last 200 events. Older history can be exported on request.
      </p>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No events yet.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="align-top hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">
                    {formatDateTime(e.createdAt)}
                  </td>
                  <td className="px-4 py-2">
                    {e.actor?.name ?? e.actor?.email ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {e.entity}{" "}
                    <span className="text-xs text-gray-400">{e.entityId.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {e.diffJson ? JSON.stringify(e.diffJson) : ""}
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
