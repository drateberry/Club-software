"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Home,
  Users,
  UsersRound,
  Building2,
  Calendar,
  Wallet,
  Receipt,
  ShieldCheck,
  CheckSquare,
  MessageSquare,
  MessagesSquare,
  Settings as SettingsIcon,
  User as UserIcon,
  QrCode,
  LogOut,
} from "lucide-react";
import clsx from "clsx";
import { signOutAction } from "@/app/(app)/actions";
import type { Capability } from "@/lib/capabilities";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  indent?: boolean;
  capability?: Capability;
};

const NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: Home },
  { href: "/members", labelKey: "nav.members", icon: Users, capability: "members.read" },
  { href: "/groups", labelKey: "nav.groups", icon: Building2, capability: "groups.read" },
  { href: "/committees", labelKey: "nav.committees", icon: UsersRound, capability: "committees.read" },
  { href: "/events", labelKey: "nav.events", icon: Calendar, capability: "events.read" },
  { href: "/calendar", labelKey: "nav.calendar", icon: Calendar },
  { href: "/finance/invoices", labelKey: "nav.invoices", icon: Receipt, capability: "finance.read" },
  { href: "/house-accounts", labelKey: "nav.houseAccounts", icon: Wallet, capability: "houseAccounts.read" },
  { href: "/compliance", labelKey: "nav.compliance", icon: ShieldCheck, capability: "compliance.read" },
  { href: "/checkin", labelKey: "nav.checkin", icon: QrCode, capability: "checkin.scan" },
  { href: "/messages", labelKey: "nav.messages", icon: MessagesSquare, capability: "messaging.read" },
  { href: "/tasks", labelKey: "nav.tasks", icon: CheckSquare },
  { href: "/feedback", labelKey: "nav.feedback", icon: MessageSquare },
  { href: "/settings", labelKey: "nav.settings", icon: SettingsIcon, capability: "settings.write" },
];

export function Sidebar({
  capabilities,
  userEmail,
  appName,
}: {
  capabilities: Capability[];
  userEmail: string;
  appName: string;
}) {
  const pathname = usePathname();
  const t = useTranslations();

  const visible = NAV.filter((item) => !item.capability || capabilities.includes(item.capability));

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="px-5 py-5 text-lg font-semibold tracking-tight">
        {appName}
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {visible.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded px-3 py-2 text-sm",
                isActive
                  ? "bg-gray-100 font-medium text-gray-900"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 px-3 py-3 text-sm">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded px-3 py-2 text-gray-700 hover:bg-gray-50"
        >
          <UserIcon className="h-4 w-4" />
          <span className="truncate">{userEmail}</span>
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded px-3 py-2 text-gray-700 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            {t("nav.signOut")}
          </button>
        </form>
      </div>
    </aside>
  );
}
