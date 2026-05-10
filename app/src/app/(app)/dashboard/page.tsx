import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { formatDate, formatMoney } from "@/lib/format";

export default async function DashboardPage() {
  await requireSession();
  const t = await getTranslations();

  const [
    totalMembers,
    openInvoices,
    outstandingAgg,
    upcomingEvents,
    openTasks,
    recentMembers,
  ] = await Promise.all([
    prisma.member.count({ where: { membershipStatus: "ACTIVE", deletedAt: null } }),
    prisma.invoice.count({ where: { status: "SENT" } }),
    prisma.invoice.aggregate({
      _sum: { totalCents: true },
      where: { status: "SENT" },
    }),
    prisma.event.findMany({
      where: { startAt: { gte: new Date() }, deletedAt: null },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.member.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, firstName: true, lastName: true, joinDate: true, memberNumber: true },
    }),
  ]);

  const outstanding = outstandingAgg._sum.totalCents ?? 0;

  const stats = [
    { label: t("dashboard.totalMembers"), value: totalMembers.toLocaleString() },
    { label: t("dashboard.openInvoices"), value: openInvoices.toLocaleString() },
    { label: t("dashboard.outstanding"), value: formatMoney(outstanding) },
    { label: t("dashboard.openTasks"), value: openTasks.length.toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            {t("dashboard.upcomingEvents")}
          </h2>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-gray-500">{t("dashboard.noEvents")}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcomingEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{e.title}</span>
                  <span className="text-gray-500">{formatDate(e.startAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("dashboard.openTasks")}</h2>
          {openTasks.length === 0 ? (
            <p className="text-sm text-gray-500">{t("dashboard.noTasks")}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {openTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{task.title}</span>
                  <span className="text-gray-500">{formatDate(task.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          {t("dashboard.recentMembers")}
        </h2>
        <ul className="divide-y divide-gray-100">
          {recentMembers.map((m) => (
            <li key={m.id} className="py-2 text-sm">
              <Link href={`/members/${m.id}`} className="hover:underline">
                {m.firstName} {m.lastName}
              </Link>
              <span className="ml-2 text-gray-500">
                #{m.memberNumber} · {formatDate(m.joinDate)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
