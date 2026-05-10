import { MessageDirection, MessageStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTwilioClient } from "./client";
import { toE164 } from "./normalize";

export type SendArgs = {
  toPhone: string;
  body?: string;
  mediaUrls?: string[];
  sentById?: string | null;
  memberId?: string | null;
};

export class TwilioNotConfiguredError extends Error {
  constructor() {
    super("Twilio is not configured for this club");
  }
}

export class OptedOutError extends Error {
  constructor(public phone: string) {
    super(`Recipient ${phone} has opted out of messaging`);
  }
}

async function ensureConversation(toE164Phone: string, memberId: string | null): Promise<string> {
  const existing = await prisma.conversation.findUnique({ where: { phone: toE164Phone } });
  if (existing) {
    if (memberId && existing.memberId !== memberId) {
      await prisma.conversation.update({ where: { id: existing.id }, data: { memberId } });
    }
    return existing.id;
  }
  const created = await prisma.conversation.create({
    data: { phone: toE164Phone, memberId: memberId ?? null },
  });
  return created.id;
}

export async function sendMessage(args: SendArgs): Promise<{ messageId: string; twilioSid: string }> {
  const e164 = toE164(args.toPhone);
  if (!e164) throw new Error(`Invalid phone number: ${args.toPhone}`);

  const optOut = await prisma.outboundOptOut.findUnique({ where: { phone: e164 } });
  if (optOut) throw new OptedOutError(e164);

  const ctx = await getTwilioClient();
  if (!ctx) throw new TwilioNotConfiguredError();

  const conversationId = await ensureConversation(e164, args.memberId ?? null);

  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: MessageDirection.OUTBOUND,
      body: args.body ?? null,
      mediaUrls: (args.mediaUrls ?? []) as unknown as Prisma.InputJsonValue,
      status: MessageStatus.QUEUED,
      sentById: args.sentById ?? null,
    },
  });

  const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
  let twilioMessage;
  try {
    twilioMessage = await ctx.client.messages.create({
      to: e164,
      from: ctx.config.fromNumber,
      body: args.body ?? "",
      mediaUrl: args.mediaUrls && args.mediaUrls.length > 0 ? args.mediaUrls : undefined,
      statusCallback: `${baseUrl}/api/webhooks/twilio/status`,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    const messageText = (err as Error).message;
    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.FAILED,
        errorCode: code ? String(code) : null,
        errorMessage: messageText,
      },
    });
    throw err;
  }

  await prisma.message.update({
    where: { id: message.id },
    data: { twilioSid: twilioMessage.sid, status: MessageStatus.SENT },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  return { messageId: message.id, twilioSid: twilioMessage.sid };
}
