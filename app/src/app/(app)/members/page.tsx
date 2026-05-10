import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 50;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requireCapability("members.read");
  const t = await getTranslations();
  const { q = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);

  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { memberNumber: { contains: q } },
          ],
        }
      : {}),
  };

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.member.count({ where }),
  ]);

  const canWrite = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "members.write"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("members.title")}</h1>
        {canWrite && (
          <Link
            href="/members/new"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
          >
            {t("members.newMember")}
          </Link>
        )}
      </div>

      <form className="flex gap-2" action="/members" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t("members.search")}
          className="w-full max-w-md rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-2">{t("members.memberNumber")}</th>
              <th className="px-4 py-2">{t("members.name")}</th>
              <th className="px-4 py-2">{t("members.class")}</th>
              <th className="px-4 py-2">{t("members.status")}</th>
              <th className="px-4 py-2">{t("members.email")}</th>
              <th className="px-4 py-2">{t("members.joined")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  {t("members.noResults")}
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">{m.memberNumber}</td>
                  <td className="px-4 py-2">
                    <Link href={`/members/${m.id}`} className="hover:underline">
                      {m.firstName} {m.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{m.membershipClass}</td>
                  <td className="px-4 py-2 text-gray-600">{m.membershipStatus}</td>
                  <td className="px-4 py-2 text-gray-600">{m.email}</td>
                  <td className="px-4 py-2 text-gray-500">{formatDate(m.joinDate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {(pageNum - 1) * PAGE_SIZE + 1}–{Math.min(pageNum * PAGE_SIZE, total)} of{" "}
          {total.toLocaleString()}
        </span>
        <div className="flex gap-2">
          {pageNum > 1 && (
            <Link
              href={`/members?q=${encodeURIComponent(q)}&page=${pageNum - 1}`}
              className="rounded border border-gray-300 px-3 py-1"
            >
              ← Previous
            </Link>
          )}
          {pageNum * PAGE_SIZE < total && (
            <Link
              href={`/members?q=${encodeURIComponent(q)}&page=${pageNum + 1}`}
              className="rounded border border-gray-300 px-3 py-1"
            >
              Next →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
