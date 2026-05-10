import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { formatDateTime, formatMoney } from "@/lib/format";

export default async function EventsPage() {
  await requireCapability("events.read");
  const t = await getTranslations();

  const events = await prisma.event.findMany({
    where: { deletedAt: null, startAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
    include: { _count: { select: { attendances: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("events.title")}</h1>
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
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  {t("events.noResults")}
                </td>
              </tr>
            ) : (
              events.map((e) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
