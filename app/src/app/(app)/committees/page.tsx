import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";

export default async function CommitteesPage() {
  await requireCapability("committees.read");
  const t = await getTranslations();

  const committees = await prisma.committee.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { memberships: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("committees.title")}</h1>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">{t("groups.name")}</th>
              <th className="px-4 py-2">{t("groups.description")}</th>
              <th className="px-4 py-2 text-right">{t("committees.memberCount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {committees.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                  {t("committees.noResults")}
                </td>
              </tr>
            ) : (
              committees.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/committees/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{c.description}</td>
                  <td className="px-4 py-2 text-right text-gray-500">
                    {c._count.memberships}
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
