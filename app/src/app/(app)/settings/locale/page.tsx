import { requireCapability } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { SETTING_KEYS, getSettingMap } from "@/lib/settings";
import { saveLocale } from "../actions";
import { SettingsTabs } from "../tabs";

export default async function LocaleSettingsPage() {
  await requireCapability("settings.write");
  const values = await getSettingMap([
    SETTING_KEYS.locale,
    SETTING_KEYS.currency,
    SETTING_KEYS.timezone,
  ] as const);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsTabs active="locale" />

      <form
        action={saveLocale}
        className="max-w-xl space-y-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-gray-700">Locale, currency, timezone</h2>
        <p className="text-xs text-gray-500">
          These drive money, date, and time formatting across the app.
        </p>
        <label className="block text-sm">
          <span className="font-medium">Locale</span>
          <input
            type="text"
            name="locale"
            required
            defaultValue={
              (values[SETTING_KEYS.locale] as string) ?? process.env.CLUB_LOCALE ?? "en-US"
            }
            placeholder="en-US"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Currency (3-letter ISO code)</span>
          <input
            type="text"
            name="currency"
            required
            maxLength={3}
            defaultValue={
              (values[SETTING_KEYS.currency] as string) ?? process.env.CLUB_CURRENCY ?? "USD"
            }
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 uppercase"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Timezone (IANA)</span>
          <input
            type="text"
            name="timezone"
            required
            defaultValue={
              (values[SETTING_KEYS.timezone] as string) ?? process.env.CLUB_TIMEZONE ?? "America/New_York"
            }
            placeholder="America/New_York"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <div className="flex justify-end">
          <SubmitButton>Save</SubmitButton>
        </div>
      </form>
    </div>
  );
}
