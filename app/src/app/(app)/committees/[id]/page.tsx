import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";

export default async function CommitteeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("committees.read");
  const t = await getTranslations();
  const { id } = await params;

  const committee = await prisma.committee.findUnique({
    where: { id },
    include: {
      memberships: {
        include: { member: true },
        orderBy: [{ member: { lastName: "asc" } }, { member: { firstName: "asc" } }],
      },
    },
  });
  if (!committee || committee.deletedAt) notFound();

  return (
    <div className="space-y-6">
      <Link href="/committees" className="text-sm text-gray-600 hover:underline">
        ← {t("committees.title")}
      </Link>
      <h1 className="text-2xl font-semibold">{committee.name}</h1>
      {committee.description && (
        <p className="text-sm text-gray-600">{committee.description}</p>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("members.title")}</h2>
        <ul className="divide-y divide-gray-100 text-sm">
          {committee.memberships.map((cm) => (
            <li key={cm.id} className="flex justify-between py-2">
              <Link href={`/members/${cm.memberId}`} className="hover:underline">
                {cm.member.firstName} {cm.member.lastName}
              </Link>
              <span className="text-gray-500">{cm.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
