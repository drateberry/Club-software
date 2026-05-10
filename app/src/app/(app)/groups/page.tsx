import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";

export default async function GroupsPage() {
  const session = await requireCapability("groups.read");
  const t = await getTranslations();

  const groups = await prisma.group.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { memberships: true } } },
  });

  const canWrite = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "groups.write"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("groups.title")}</h1>
        {canWrite && (
          <Link
            href="/groups/new"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
          >
            {t("groups.newGroup")}
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">{t("groups.name")}</th>
              <th className="px-4 py-2">{t("groups.description")}</th>
              <th className="px-4 py-2 text-right">{t("groups.memberCount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                  {t("groups.noResults")}
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/groups/${g.id}`} className="hover:underline">
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{g.description}</td>
                  <td className="px-4 py-2 text-right text-gray-500">
                    {g._count.memberships}
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
