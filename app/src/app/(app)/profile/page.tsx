import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { formatHuman } from "@/lib/twilio/normalize";
import { resolveLocale, SUPPORTED_LOCALES } from "@/i18n/request";
import { setLocale } from "./locale-action";

export default async function ProfilePage() {
  const session = await requireSession();
  const t = await getTranslations();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { member: true },
  });
  const currentLocale = await resolveLocale();

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{t("profile.title")}</h1>
        {user?.member && (
          <Link
            href="/profile/edit"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Edit profile
          </Link>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <div>
          <div className="text-xs uppercase text-gray-500">{t("profile.email")}</div>
          <div>{user?.member?.email ?? user?.email}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">{t("profile.name")}</div>
          <div>
            {user?.member
              ? `${user.member.firstName} ${user.member.lastName}`
              : user?.name ?? "—"}
          </div>
        </div>
        {user?.member?.phone && (
          <div>
            <div className="text-xs uppercase text-gray-500">{t("members.phone")}</div>
            <div>{formatHuman(user.member.phone)}</div>
          </div>
        )}
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

      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <Link
          href="/profile/notifications"
          className="text-sm text-gray-600 hover:underline"
        >
          Notification preferences →
        </Link>
      </div>

      <form
        action={setLocale}
        className="rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="mb-2 text-xs uppercase text-gray-500">Language</div>
        <label className="flex items-center gap-2 text-sm">
          <select
            name="locale"
            defaultValue={currentLocale}
            className="rounded border border-gray-300 px-3 py-2"
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {loc === "en-US" ? "English (US)" : loc === "es-US" ? "Español (US)" : loc}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
          >
            Save
          </button>
        </label>
        <p className="mt-2 text-xs text-gray-500">
          Switches the language of the web app for this device. Set per-user
          across devices is in a future round.
        </p>
      </form>
    </div>
  );
}
