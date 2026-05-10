import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireCapability } from "@/lib/guards";

const TABS = [
  { href: "/settings", labelKey: "settings.tabs.branding" },
  { href: "/settings/locale", labelKey: "settings.tabs.locale" },
  { href: "/settings/payments", labelKey: "settings.tabs.payments" },
  { href: "/settings/email", labelKey: "settings.tabs.email" },
  { href: "/settings/house-accounts", labelKey: "settings.tabs.houseAccounts" },
  { href: "/settings/compliance", labelKey: "settings.tabs.compliance" },
  { href: "/settings/users", labelKey: "settings.tabs.users" },
];

export default async function SettingsPage() {
  await requireCapability("settings.write");
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            {t(tab.labelKey)}
          </Link>
        ))}
      </nav>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-700">
          {t("settings.tabs.branding")}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <dt className="text-gray-500">{t("settings.branding.clubName")}</dt>
          <dd>{process.env.CLUB_NAME ?? "Club OS"}</dd>
          <dt className="text-gray-500">Locale</dt>
          <dd>{process.env.CLUB_LOCALE ?? "en-US"}</dd>
          <dt className="text-gray-500">Currency</dt>
          <dd>{process.env.CLUB_CURRENCY ?? "USD"}</dd>
          <dt className="text-gray-500">Timezone</dt>
          <dd>{process.env.CLUB_TIMEZONE ?? "America/New_York"}</dd>
        </dl>
        <p className="mt-4 text-xs text-gray-500">
          Editable settings UI lands in Phase 5. Values currently come from environment
          variables; deeper config (Stripe keys, email provider, capabilities) will move
          into the Setting table.
        </p>
      </div>
    </div>
  );
}
