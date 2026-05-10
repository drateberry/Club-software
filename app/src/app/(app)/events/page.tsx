import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime, formatMoney } from "@/lib/format";

export default async function EventsPage() {
  const session = await requireCapability("events.read");
  const t = await getTranslations();
  const canWrite = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "events.write"
  );

  const events = await prisma.event.findMany({
    where: { deletedAt: null, startAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
    include: { _count: { select: { attendances: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("events.title")}</h1>
        {canWrite && (
          <Link
            href="/events/new"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
          >
            New event
          </Link>
        )}
      </div>
      {events.length === 0 ? (
        <EmptyState
          title={t("events.noResults")}
          description="Schedule your first event to manage RSVPs and ticket sales."
          cta={canWrite ? { href: "/events/new", label: "New event" } : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">{t("groups.name")}</th>
                <th className="px-4 py-2">{t("dashboard.upcomingEvents")}</th>
                <th className="px-4 py-2">{t("events.venue")}</th>
                <th className="px-4 py-2">{t("events.capacity")}</th>
                <th className="px-4 py-2">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/events/${e.id}`} className="hover:underline">
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{formatDateTime(e.startAt)}</td>
                  <td className="px-4 py-2 text-gray-600">{e.venue}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {e._count.attendances}
                    {e.capacity ? ` / ${e.capacity}` : ""}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {e.isTicketed
                      ? `${t("events.ticketed")} · ${formatMoney(e.memberPriceCents)}`
                      : t("events.free")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
