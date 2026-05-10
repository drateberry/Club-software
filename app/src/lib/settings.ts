import { prisma } from "@/lib/db";

export const SETTING_KEYS = {
  clubName: "branding.clubName",
  primaryColor: "branding.primaryColor",
  logoUrl: "branding.logoUrl",
  locale: "locale.locale",
  currency: "locale.currency",
  timezone: "locale.timezone",
  emailFrom: "email.from",
  twilioAccountSid: "twilio.accountSid",
  twilioAuthToken: "twilio.authToken",
  twilioFromNumber: "twilio.fromNumber",
  messagingHelpText: "messaging.helpText",
  messagingTriggers: "messaging.triggers",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS] | (string & {});

export async function getSetting<T = string>(
  key: SettingKey,
  fallback: T
): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  return row.valueJson as T;
}

export async function getSettingMap<K extends SettingKey>(
  keys: readonly K[]
): Promise<Record<K, unknown>> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: keys as unknown as string[] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.valueJson])) as Record<
    string,
    unknown
  >;
  return Object.fromEntries(keys.map((k) => [k, map[k]])) as Record<K, unknown>;
}

export async function setSetting(key: SettingKey, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, valueJson: (value ?? null) as never },
    update: { valueJson: (value ?? null) as never },
  });
}
