import { prisma } from "@/lib/db";
import type { TriggerKey } from "@/lib/twilio/triggers";

export type Channel = "sms" | "email";

export type NotificationPrefs = Partial<Record<Channel, Partial<Record<TriggerKey, boolean>>>>;

/**
 * Whether a trigger is enabled for the given member's user account on a
 * specific channel. Default-on: missing keys mean the user hasn't opted
 * out yet. Returns true when there is no linked User row (e.g. member
 * has no app account).
 */
export async function isTriggerEnabledForMember(
  memberId: string,
  trigger: TriggerKey,
  channel: Channel
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { memberId },
    select: { notificationPrefs: true },
  });
  if (!user) return true;
  const prefs = (user.notificationPrefs as NotificationPrefs | null) ?? {};
  const channelPrefs = prefs[channel] ?? {};
  return channelPrefs[trigger] !== false;
}
