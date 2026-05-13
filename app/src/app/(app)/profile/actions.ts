"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { logAudit } from "@/lib/audit";
import { memberChanged } from "@/lib/mcp/events";

const profileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().max(50).optional(),
});

export async function updateMyProfile(formData: FormData) {
  const session = await requireSession();
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { memberId: true, email: true },
  });
  if (!me?.memberId) {
    redirect("/profile?err=No%20member%20linked%20to%20your%20account");
  }

  const parsed = profileSchema.parse({
    firstName: formData.get("firstName") ?? undefined,
    lastName: formData.get("lastName") ?? undefined,
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
  });

  const data: Record<string, string | null> = {};
  if (parsed.firstName !== undefined) data.firstName = parsed.firstName;
  if (parsed.lastName !== undefined) data.lastName = parsed.lastName;
  if (parsed.email !== undefined) data.email = parsed.email || null;
  if (parsed.phone !== undefined) data.phone = parsed.phone || null;

  await prisma.member.update({
    where: { id: me.memberId },
    data,
  });

  await logAudit(session.user.id, "member.update", "Member", me.memberId, {
    source: "self-serve",
    fields: Object.keys(data),
  });
  memberChanged(me.memberId);

  revalidatePath("/profile");
  revalidatePath(`/members/${me.memberId}`);
  redirect("/profile?ok=Profile%20updated");
}

const TRIGGERS = ["invoice.sent", "payment.received", "rsvp.confirmed", "statement.generated"] as const;
const CHANNELS = ["sms", "email"] as const;

export async function saveNotificationPrefs(formData: FormData) {
  const session = await requireSession();

  const prefs: Record<string, Record<string, boolean>> = {};
  for (const channel of CHANNELS) {
    prefs[channel] = {};
    for (const trigger of TRIGGERS) {
      prefs[channel][trigger] = formData.get(`${channel}.${trigger}`) === "on";
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationPrefs: prefs as never },
  });
  await logAudit(session.user.id, "settings.update", "User", session.user.id, {
    action: "notificationPrefs",
  });

  revalidatePath("/profile/notifications");
  redirect("/profile/notifications?ok=Preferences%20saved");
}
