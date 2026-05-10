"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SETTING_KEYS, setSetting } from "@/lib/settings";
import { requireCapability } from "@/lib/guards";
import { logAudit } from "@/lib/audit";

const brandingSchema = z.object({
  clubName: z.string().min(1).max(200),
  logoUrl: z.string().url().or(z.literal("")).optional(),
  primaryColor: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/)
    .or(z.literal(""))
    .optional(),
});

export async function saveBranding(formData: FormData) {
  const session = await requireCapability("settings.write");
  const parsed = brandingSchema.parse({
    clubName: formData.get("clubName"),
    logoUrl: formData.get("logoUrl") ?? "",
    primaryColor: formData.get("primaryColor") ?? "",
  });

  await Promise.all([
    setSetting(SETTING_KEYS.clubName, parsed.clubName),
    setSetting(SETTING_KEYS.logoUrl, parsed.logoUrl || null),
    setSetting(SETTING_KEYS.primaryColor, parsed.primaryColor || null),
  ]);
  await logAudit(session.user.id, "settings.update", "Setting", "branding", parsed);
  revalidatePath("/settings");
  redirect("/settings?ok=Saved");
}

const localeSchema = z.object({
  locale: z.string().min(2).max(20),
  currency: z.string().length(3),
  timezone: z.string().min(2).max(50),
});

export async function saveLocale(formData: FormData) {
  const session = await requireCapability("settings.write");
  const parsed = localeSchema.parse({
    locale: formData.get("locale"),
    currency: String(formData.get("currency") ?? "").toUpperCase(),
    timezone: formData.get("timezone"),
  });

  await Promise.all([
    setSetting(SETTING_KEYS.locale, parsed.locale),
    setSetting(SETTING_KEYS.currency, parsed.currency),
    setSetting(SETTING_KEYS.timezone, parsed.timezone),
  ]);
  await logAudit(session.user.id, "settings.update", "Setting", "locale", parsed);
  revalidatePath("/settings");
  redirect("/settings/locale?ok=Saved");
}

const emailSchema = z.object({
  from: z.string().min(3).max(200),
});

export async function saveEmailSettings(formData: FormData) {
  const session = await requireCapability("settings.write");
  const parsed = emailSchema.parse({ from: formData.get("from") });
  await setSetting(SETTING_KEYS.emailFrom, parsed.from);
  await logAudit(session.user.id, "settings.update", "Setting", "email", parsed);
  redirect("/settings/email?ok=Saved");
}
