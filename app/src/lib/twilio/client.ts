import twilio, { Twilio } from "twilio";
import { prisma } from "@/lib/db";

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

let cachedClient: Twilio | null = null;
let cachedConfig: TwilioConfig | null = null;

export async function getTwilioConfig(): Promise<TwilioConfig | null> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["twilio.accountSid", "twilio.authToken", "twilio.fromNumber"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.valueJson])) as Record<string, string | null>;
  const accountSid = map["twilio.accountSid"];
  const authToken = map["twilio.authToken"];
  const fromNumber = map["twilio.fromNumber"];
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

export async function getTwilioClient(): Promise<{ client: Twilio; config: TwilioConfig } | null> {
  const config = await getTwilioConfig();
  if (!config) return null;
  if (cachedClient && cachedConfig?.accountSid === config.accountSid && cachedConfig?.authToken === config.authToken) {
    return { client: cachedClient, config };
  }
  cachedClient = twilio(config.accountSid, config.authToken);
  cachedConfig = config;
  return { client: cachedClient, config };
}

export function resetTwilioCache() {
  cachedClient = null;
  cachedConfig = null;
}
