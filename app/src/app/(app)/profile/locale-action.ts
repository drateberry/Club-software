"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/guards";
import { logAudit } from "@/lib/audit";
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@/i18n/request";

function isSupported(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export async function setLocale(formData: FormData) {
  const session = await requireSession();
  const requested = String(formData.get("locale") ?? "").trim();
  if (!isSupported(requested)) {
    redirect("/profile?err=Unsupported%20locale");
  }
  const store = await cookies();
  store.set(LOCALE_COOKIE, requested, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  await logAudit(session.user.id, "settings.update", "User", session.user.id, {
    action: "locale",
    locale: requested,
  });
  revalidatePath("/profile");
  redirect("/profile?ok=Idioma%20guardado");
}
