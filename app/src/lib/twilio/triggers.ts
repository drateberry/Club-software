import { prisma } from "@/lib/db";
import { getQueue, QUEUES } from "@/lib/jobs/queue";
import { toE164 } from "./normalize";
import type { SendArgs } from "./send";

export type TriggerKey =
  | "invoice.sent"
  | "payment.received"
  | "rsvp.confirmed"
  | "statement.generated";

export type TriggerConfig = {
  enabled: boolean;
  template: string;
};

export type TriggerMap = Record<TriggerKey, TriggerConfig>;

export const DEFAULT_TRIGGERS: TriggerMap = {
  "invoice.sent": {
    enabled: false,
    template: "{club_name}: Your invoice {invoice_number} is ready. Pay: {payment_url}",
  },
  "payment.received": {
    enabled: false,
    template: "{club_name}: Thanks {first_name} — we received your payment of {amount}.",
  },
  "rsvp.confirmed": {
    enabled: false,
    template: "{club_name}: Your RSVP for {event_title} is confirmed. See you {event_date}!",
  },
  "statement.generated": {
    enabled: false,
    template: "{club_name}: Your monthly statement {invoice_number} for {amount} is ready. Pay: {payment_url}",
  },
};

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

async function loadTriggers(): Promise<TriggerMap> {
  const row = await prisma.setting.findUnique({ where: { key: "messaging.triggers" } });
  if (!row?.valueJson) return DEFAULT_TRIGGERS;
  const stored = row.valueJson as Partial<TriggerMap>;
  return { ...DEFAULT_TRIGGERS, ...stored };
}

/**
 * Enqueue a triggered message if the trigger is enabled and the recipient
 * hasn't opted out. Silent no-op otherwise.
 */
export async function enqueueTriggered(
  trigger: TriggerKey,
  args: { memberId: string; vars: Record<string, string> }
): Promise<void> {
  const triggers = await loadTriggers();
  const config = triggers[trigger];
  if (!config?.enabled) return;

  const member = await prisma.member.findUnique({
    where: { id: args.memberId },
    select: { id: true, phone: true, twilioOptedOut: true, firstName: true, lastName: true },
  });
  if (!member?.phone || member.twilioOptedOut) return;
  const e164 = toE164(member.phone);
  if (!e164) return;

  const optOut = await prisma.outboundOptOut.findUnique({ where: { phone: e164 } });
  if (optOut) return;

  const clubName =
    ((await prisma.setting.findUnique({ where: { key: "branding.clubName" } }))?.valueJson as string) ??
    process.env.CLUB_NAME ??
    "the club";

  const body = applyTemplate(config.template, {
    club_name: clubName,
    first_name: member.firstName,
    last_name: member.lastName,
    member_name: `${member.firstName} ${member.lastName}`,
    ...args.vars,
  });

  const boss = await getQueue();
  await boss.send(QUEUES.messagingSend, {
    toPhone: e164,
    body,
    memberId: member.id,
  } satisfies SendArgs);
}
