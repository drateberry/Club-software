import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { updateGroup } from "../actions";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCapability("groups.read");
  const t = await getTranslations();
  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      memberships: {
        include: { member: true },
        orderBy: [{ member: { lastName: "asc" } }, { member: { firstName: "asc" } }],
      },
    },
  });
  if (!group || group.deletedAt) notFound();

  const canWrite = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "groups.write"
  );
  const update = updateGroup.bind(null, id);

  return (
    <div className="space-y-6">
      <Link href="/groups" className="text-sm text-gray-600 hover:underline">
        ← {t("groups.title")}
      </Link>
      <h1 className="text-2xl font-semibold">{group.name}</h1>

      <form action={update} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <label className="block text-sm">
          <span className="font-medium">{t("groups.name")}</span>
          <input
            type="text"
            name="name"
            defaultValue={group.name}
            disabled={!canWrite}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-50"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("groups.description")}</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={group.description ?? ""}
            disabled={!canWrite}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-50"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Type</span>
          <input
            type="text"
            name="type"
            defaultValue={group.type ?? ""}
            disabled={!canWrite}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-50"
          />
        </label>
        {canWrite && (
          <div className="flex justify-end">
            <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
              {t("common.save")}
            </button>
          </div>
        )}
      </form>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          {t("members.title")}
        </h2>
        {group.memberships.length === 0 ? (
          <p className="text-sm text-gray-500">{t("groups.noMembers")}</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {group.memberships.map((gm) => (
              <li key={gm.id} className="flex justify-between py-2">
                <Link href={`/members/${gm.memberId}`} className="hover:underline">
                  {gm.member.firstName} {gm.member.lastName}
                </Link>
                <span className="text-gray-500">{gm.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
