import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireCapability } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { SETTING_KEYS, getSettingMap } from "@/lib/settings";
import { saveBranding } from "./actions";
import { SettingsTabs } from "./tabs";

export default async function SettingsPage() {
  await requireCapability("settings.write");
  const t = await getTranslations();

  const values = await getSettingMap([
    SETTING_KEYS.clubName,
    SETTING_KEYS.logoUrl,
    SETTING_KEYS.primaryColor,
  ] as const);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
      <SettingsTabs active="branding" />

      <form
        action={saveBranding}
        className="max-w-xl space-y-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-gray-700">Branding</h2>
        <label className="block text-sm">
          <span className="font-medium">Club name</span>
          <input
            type="text"
            name="clubName"
            required
            defaultValue={
              (values[SETTING_KEYS.clubName] as string) ?? process.env.CLUB_NAME ?? ""
            }
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Logo URL</span>
          <input
            type="url"
            name="logoUrl"
            defaultValue={(values[SETTING_KEYS.logoUrl] as string) ?? ""}
            placeholder="https://…/logo.svg"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Primary color (hex)</span>
          <input
            type="text"
            name="primaryColor"
            defaultValue={(values[SETTING_KEYS.primaryColor] as string) ?? ""}
            placeholder="#0E7C66"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <div className="flex justify-end">
          <SubmitButton>Save</SubmitButton>
        </div>
      </form>

      <p className="text-xs text-gray-500">
        Other tabs:{" "}
        <Link href="/settings/locale" className="underline">Locale</Link>{" "}·{" "}
        <Link href="/settings/email" className="underline">Email</Link>{" "}·{" "}
        <Link href="/settings/import" className="underline">Import members</Link>{" "}·{" "}
        <Link href="/settings/audit" className="underline">Audit log</Link>
      </p>
    </div>
  );
}
