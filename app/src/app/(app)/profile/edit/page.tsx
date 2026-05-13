import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { updateMyProfile } from "../actions";

export default async function EditProfilePage() {
  const session = await requireSession();
  const t = await getTranslations();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { member: true },
  });
  if (!user?.member) {
    redirect("/profile?err=No%20member%20linked%20to%20your%20account");
  }
  const m = user!.member!;

  return (
    <div className="max-w-xl space-y-4">
      <Link href="/profile" className="text-sm text-gray-600 hover:underline">
        ← {t("profile.title")}
      </Link>
      <h1 className="text-2xl font-semibold">Edit profile</h1>
      <p className="text-sm text-gray-500">
        These changes update your own member record. Staff are notified via the
        audit log.
      </p>

      <form
        action={updateMyProfile}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">{t("members.firstName")}</span>
            <input
              type="text"
              name="firstName"
              required
              defaultValue={m.firstName}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t("members.lastName")}</span>
            <input
              type="text"
              name="lastName"
              required
              defaultValue={m.lastName}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium">{t("members.email")}</span>
          <input
            type="email"
            name="email"
            defaultValue={m.email ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("members.phone")}</span>
          <input
            type="tel"
            name="phone"
            defaultValue={m.phone ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Link
            href="/profile"
            className="rounded border border-gray-300 px-4 py-2 text-sm"
          >
            {t("common.cancel")}
          </Link>
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </div>
      </form>
    </div>
  );
}
