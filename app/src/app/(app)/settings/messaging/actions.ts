"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SETTING_KEYS, setSetting } from "@/lib/settings";
import { requireCapability } from "@/lib/guards";
import { logAudit } from "@/lib/audit";
import { resetTwilioCache } from "@/lib/twilio/client";

const twilioSchema = z.object({
  accountSid: z.string().min(34).max(34).regex(/^AC[0-9a-fA-F]{32}$/, "Twilio Account SID looks like ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),
  authToken: z.string().min(8).max(200),
  fromNumber: z.string().min(8).max(20),
  helpText: z.string().max(500).optional().or(z.literal("")),
});

export async function saveTwilioSettings(formData: FormData) {
  const session = await requireCapability("settings.write");
  const parsed = twilioSchema.parse({
    accountSid: formData.get("accountSid"),
    authToken: formData.get("authToken"),
    fromNumber: formData.get("fromNumber"),
    helpText: formData.get("helpText") ?? "",
  });

  await Promise.all([
    setSetting(SETTING_KEYS.twilioAccountSid, parsed.accountSid),
    setSetting(SETTING_KEYS.twilioAuthToken, parsed.authToken),
    setSetting(SETTING_KEYS.twilioFromNumber, parsed.fromNumber),
    setSetting(SETTING_KEYS.messagingHelpText, parsed.helpText || null),
  ]);
  resetTwilioCache();

  await logAudit(session.user.id, "settings.update", "Setting", "messaging", {
    accountSid: parsed.accountSid,
    fromNumber: parsed.fromNumber,
  });
  revalidatePath("/settings/messaging");
  redirect("/settings/messaging?ok=Saved");
}
