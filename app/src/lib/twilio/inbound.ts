import { MessageDirection, MessageStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toE164 } from "./normalize";

const STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const HELP_KEYWORDS = ["HELP", "INFO"];
const START_KEYWORDS = ["START", "YES", "UNSTOP"];

export type InboundPayload = {
  fromPhone: string;
  body: string | null;
  twilioSid: string;
  mediaUrls: string[];
};

export type InboundOutcome =
  | { reply: string | null; opted: "out" | "in" | null }
  | { error: string };

async function getHelpReply(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: "messaging.helpText" } });
  if (setting?.valueJson && typeof setting.valueJson === "string") return setting.valueJson;
  const club =
    (await prisma.setting.findUnique({ where: { key: "branding.clubName" } }))?.valueJson ??
    process.env.CLUB_NAME ??
    "the club";
  return `${club}: Reply STOP to opt out, HELP for help.`;
}

export async function handleInbound(payload: InboundPayload): Promise<InboundOutcome> {
  const e164 = toE164(payload.fromPhone);
  if (!e164) return { error: "Invalid sender number" };

  const member = await prisma.member.findFirst({
    where: { phone: { not: null }, deletedAt: null },
    include: { user: true },
  });
  let matchedMemberId: string | null = null;
  if (member) {
    const candidates = await prisma.member.findMany({
      where: { phone: { not: null }, deletedAt: null },
      select: { id: true, phone: true },
    });
    const match = candidates.find((m) => toE164(m.phone) === e164);
    if (match) matchedMemberId = match.id;
  }

  const body = (payload.body ?? "").trim();
  const upper = body.toUpperCase();
  const isStop = STOP_KEYWORDS.some((k) => upper === k || upper.startsWith(`${k} `));
  const isHelp = HELP_KEYWORDS.some((k) => upper === k || upper.startsWith(`${k} `));
  const isStart = START_KEYWORDS.some((k) => upper === k || upper.startsWith(`${k} `));

  const conversation = await prisma.conversation.upsert({
    where: { phone: e164 },
    create: {
      phone: e164,
      memberId: matchedMemberId,
      unread: true,
      optedOut: isStop,
    },
    update: {
      memberId: matchedMemberId ?? undefined,
      unread: true,
      lastMessageAt: new Date(),
      optedOut: isStop ? true : isStart ? false : undefined,
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: MessageDirection.INBOUND,
      body: payload.body ?? null,
      mediaUrls: payload.mediaUrls as unknown as Prisma.InputJsonValue,
      status: MessageStatus.RECEIVED,
      twilioSid: payload.twilioSid,
    },
  });

  if (isStop) {
    await prisma.outboundOptOut.upsert({
      where: { phone: e164 },
      create: { phone: e164, reason: "Member STOP keyword" },
      update: {},
    });
    if (matchedMemberId) {
      await prisma.member.update({
        where: { id: matchedMemberId },
        data: { twilioOptedOut: true },
      });
    }
    return {
      reply:
        "You have been unsubscribed and will no longer receive texts from us. Reply START to opt back in.",
      opted: "out",
    };
  }

  if (isStart) {
    await prisma.outboundOptOut.deleteMany({ where: { phone: e164 } });
    if (matchedMemberId) {
      await prisma.member.update({
        where: { id: matchedMemberId },
        data: { twilioOptedOut: false },
      });
    }
    return {
      reply: "You are subscribed. Reply STOP to unsubscribe at any time.",
      opted: "in",
    };
  }

  if (isHelp) {
    return { reply: await getHelpReply(), opted: null };
  }

  return { reply: null, opted: null };
}
