import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { formatDateTime } from "@/lib/format";

export default async function CalendarPage() {
  await requireSession();
  const t = await getTranslations();

  const now = new Date();
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + 3);

  const [events, calendarEvents] = await Promise.all([
    prisma.event.findMany({
      where: { startAt: { gte: now, lte: horizon }, deletedAt: null },
      orderBy: { startAt: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { start: { gte: now, lte: horizon } },
      orderBy: { start: "asc" },
    }),
  ]);

  const merged = [
    ...events.map((e) => ({ id: e.id, title: e.title, start: e.startAt, location: e.venue, kind: "event" as const })),
    ...calendarEvents.map((c) => ({ id: c.id, title: c.title, start: c.start, location: c.location, kind: "calendar" as const })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("calendar.title")}</h1>
      {merged.length === 0 ? (
        <p className="text-sm text-gray-500">{t("calendar.noEvents")}</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {merged.map((m) => (
            <li key={`${m.kind}-${m.id}`} className="flex items-center justify-between p-4 text-sm">
              <div>
                <div className="font-medium">{m.title}</div>
                {m.location && <div className="text-gray-500">{m.location}</div>}
              </div>
              <div className="text-gray-500">{formatDateTime(m.start)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
