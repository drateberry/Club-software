import { prisma } from "@/lib/db";
import { getQueue, QUEUES } from "@/lib/jobs/queue";
import { toE164 } from "./normalize";
import type { SendArgs } from "./send";

export type BulkSendResult = {
  enqueued: number;
  skippedNoPhone: number;
  skippedOptedOut: number;
  total: number;
};

/**
 * Fan out an SMS to many members, throttled via pg-boss (1 job per member).
 * Skips members with no phone, with twilioOptedOut, or whose phone is in
 * OutboundOptOut. Returns counts so the caller can surface the outcome.
 */
export async function bulkSendToMembers(args: {
  memberIds: string[];
  body: string;
  sentById: string | null;
}): Promise<BulkSendResult> {
  const members = await prisma.member.findMany({
    where: { id: { in: args.memberIds }, deletedAt: null },
    select: { id: true, phone: true, twilioOptedOut: true },
  });

  const phones = members
    .map((m) => ({ id: m.id, e164: toE164(m.phone), optedOut: m.twilioOptedOut }))
    .filter((m) => m.e164);

  const optOuts = phones.length
    ? await prisma.outboundOptOut.findMany({
        where: { phone: { in: phones.map((p) => p.e164!) } },
      })
    : [];
  const optedOutSet = new Set(optOuts.map((o) => o.phone));

  let enqueued = 0;
  const skippedNoPhone = members.length - phones.length;
  let skippedOptedOut = 0;

  const boss = await getQueue();
  for (const m of phones) {
    if (m.optedOut || optedOutSet.has(m.e164!)) {
      skippedOptedOut += 1;
      continue;
    }
    await boss.send(QUEUES.messagingSend, {
      toPhone: m.e164!,
      body: args.body,
      sentById: args.sentById,
      memberId: m.id,
    } satisfies SendArgs);
    enqueued += 1;
  }

  return {
    enqueued,
    skippedNoPhone,
    skippedOptedOut,
    total: members.length,
  };
}
