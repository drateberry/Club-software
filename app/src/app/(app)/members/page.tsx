import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { MembersTable } from "./MembersTable";

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

  const caps = (session.user.capabilities ?? []) as Capability[];
  const canWrite = hasCapability(session.user.role, caps, "members.write");
  const canBulkSendSms = hasCapability(session.user.role, caps, "messaging.bulkSend");

  const rows = members.map((m) => ({
    id: m.id,
    memberNumber: m.memberNumber,
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email,
    phone: m.phone,
    membershipClass: m.membershipClass,
    membershipStatus: m.membershipStatus,
    joinDateFormatted: formatDate(m.joinDate),
  }));

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

      {total === 0 && !q ? (
        <EmptyState
          title="No members yet"
          description="Add your first member, or import a roster from CSV in Settings."
          cta={canWrite ? { href: "/members/new", label: t("members.newMember") } : undefined}
        />
      ) : (
        <MembersTable rows={rows} canWrite={canWrite} canBulkSendSms={canBulkSendSms} />
      )}

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {total === 0 ? 0 : (pageNum - 1) * PAGE_SIZE + 1}–{Math.min(pageNum * PAGE_SIZE, total)} of{" "}
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
