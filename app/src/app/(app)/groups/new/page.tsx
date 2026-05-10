import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireCapability } from "@/lib/guards";
import { createGroup } from "../actions";

export default async function NewGroupPage() {
  await requireCapability("groups.write");
  const t = await getTranslations();
  return (
    <div className="max-w-xl space-y-4">
      <Link href="/groups" className="text-sm text-gray-600 hover:underline">
        ← {t("groups.title")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("groups.newGroup")}</h1>
      <form action={createGroup} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <label className="block text-sm">
          <span className="font-medium">{t("groups.name")}</span>
          <input
            type="text"
            name="name"
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("groups.description")}</span>
          <textarea
            name="description"
            rows={3}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Type</span>
          <input
            type="text"
            name="type"
            placeholder="interest / committee / other"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Link href="/groups" className="rounded border border-gray-300 px-4 py-2 text-sm">
            {t("common.cancel")}
          </Link>
          <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
