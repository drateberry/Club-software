import Link from "next/link";

const TABS = [
  { id: "branding", label: "Branding", href: "/settings" },
  { id: "locale", label: "Locale", href: "/settings/locale" },
  { id: "email", label: "Email", href: "/settings/email" },
  { id: "messaging", label: "Messaging", href: "/settings/messaging" },
  { id: "import", label: "Import", href: "/settings/import" },
  { id: "audit", label: "Audit log", href: "/settings/audit" },
] as const;

export type SettingsTabId = (typeof TABS)[number]["id"];

export function SettingsTabs({ active }: { active: SettingsTabId }) {
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`rounded border px-3 py-1 ${
            active === tab.id
              ? "border-black bg-black text-white"
              : "border-gray-300 bg-white"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
