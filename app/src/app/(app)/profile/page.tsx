import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";

export default async function ProfilePage() {
  const session = await requireSession();
  const t = await getTranslations();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { member: true },
  });

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("profile.title")}</h1>
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <div>
          <div className="text-xs uppercase text-gray-500">{t("profile.email")}</div>
          <div>{user?.email}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">{t("profile.name")}</div>
          <div>{user?.name ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">Role</div>
          <div>{user?.role}</div>
        </div>
        {user?.member && (
          <div>
            <div className="text-xs uppercase text-gray-500">{t("profile.memberLink")}</div>
            <Link
              href={`/members/${user.member.id}`}
              className="text-blue-600 hover:underline"
            >
              {user.member.firstName} {user.member.lastName}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
