import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireCapability } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { createMember } from "../actions";

export default async function NewMemberPage() {
  await requireCapability("members.write");
  const t = await getTranslations();

  return (
    <div className="max-w-xl space-y-4">
      <Link href="/members" className="text-sm text-gray-600 hover:underline">
        ← {t("members.title")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("members.newMember")}</h1>

      <form action={createMember} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">{t("members.firstName")}</span>
            <input
              type="text"
              name="firstName"
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t("members.lastName")}</span>
            <input
              type="text"
              name="lastName"
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium">{t("members.email")}</span>
          <input
            type="email"
            name="email"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("members.phone")}</span>
          <input
            type="tel"
            name="phone"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">{t("members.memberNumber")}</span>
            <input
              type="text"
              name="memberNumber"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t("members.class")}</span>
            <input
              type="text"
              name="membershipClass"
              placeholder="Full / Social / Junior"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Link
            href="/members"
            className="rounded border border-gray-300 px-4 py-2 text-sm"
          >
            {t("common.cancel")}
          </Link>
          <SubmitButton pendingLabel="Creating…">{t("common.save")}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
