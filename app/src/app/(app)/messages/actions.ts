"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { logAudit } from "@/lib/audit";
import { sendMessage, OptedOutError, TwilioNotConfiguredError } from "@/lib/twilio/send";
import { toE164 } from "@/lib/twilio/normalize";

const replySchema = z.object({
  body: z.string().min(1).max(1600),
});

export async function sendReply(conversationId: string, formData: FormData) {
  const session = await requireCapability("messaging.write");
  const parsed = replySchema.parse({ body: formData.get("body") });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) {
    redirect(`/messages?err=Conversation%20not%20found`);
  }

  try {
    await sendMessage({
      toPhone: conversation.phone,
      body: parsed.body,
      sentById: session.user.id,
      memberId: conversation.memberId,
    });
  } catch (err) {
    if (err instanceof OptedOutError) {
      redirect(`/messages/${conversationId}?err=Recipient%20has%20opted%20out`);
    }
    if (err instanceof TwilioNotConfiguredError) {
      redirect(`/messages/${conversationId}?err=Twilio%20is%20not%20configured`);
    }
    throw err;
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unread: false, lastMessageAt: new Date() },
  });

  await logAudit(session.user.id, "message.send", "Conversation", conversationId, {
    bodyLength: parsed.body.length,
  });

  revalidatePath(`/messages/${conversationId}`);
  redirect(`/messages/${conversationId}?ok=Message%20sent`);
}

const memberSendSchema = z.object({
  memberId: z.string().min(1),
  body: z.string().min(1).max(1600),
});

export async function sendToMember(formData: FormData) {
  const session = await requireCapability("messaging.write");
  const parsed = memberSendSchema.parse({
    memberId: formData.get("memberId"),
    body: formData.get("body"),
  });

  const member = await prisma.member.findUnique({
    where: { id: parsed.memberId },
    select: { id: true, phone: true, twilioOptedOut: true },
  });
  if (!member?.phone) {
    redirect(`/members/${parsed.memberId}?err=Member%20has%20no%20phone%20on%20file`);
  }
  if (member.twilioOptedOut) {
    redirect(`/members/${parsed.memberId}?err=Member%20has%20opted%20out%20of%20texts`);
  }

  const e164 = toE164(member.phone);
  if (!e164) {
    redirect(`/members/${parsed.memberId}?err=Phone%20number%20could%20not%20be%20parsed`);
  }

  try {
    await sendMessage({
      toPhone: e164,
      body: parsed.body,
      sentById: session.user.id,
      memberId: member.id,
    });
  } catch (err) {
    if (err instanceof OptedOutError) {
      redirect(`/members/${parsed.memberId}?err=Member%20has%20opted%20out%20of%20texts`);
    }
    if (err instanceof TwilioNotConfiguredError) {
      redirect(`/members/${parsed.memberId}?err=Twilio%20is%20not%20configured`);
    }
    throw err;
  }

  await logAudit(session.user.id, "message.send", "Member", member.id, {
    bodyLength: parsed.body.length,
  });

  const conversation = await prisma.conversation.findUnique({ where: { phone: e164 } });
  revalidatePath(`/members/${member.id}`);
  if (conversation) {
    revalidatePath(`/messages/${conversation.id}`);
    redirect(`/messages/${conversation.id}?ok=Message%20sent`);
  }
  redirect(`/members/${member.id}?ok=Message%20sent`);
}

export async function reOptIn(memberId: string) {
  const session = await requireCapability("messaging.write");
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { phone: true },
  });
  const e164 = toE164(member?.phone);
  await prisma.$transaction(async (tx) => {
    if (e164) {
      await tx.outboundOptOut.deleteMany({ where: { phone: e164 } });
      await tx.conversation.updateMany({
        where: { phone: e164 },
        data: { optedOut: false },
      });
    }
    await tx.member.update({
      where: { id: memberId },
      data: { twilioOptedOut: false },
    });
  });
  await logAudit(session.user.id, "message.optIn", "Member", memberId);
  revalidatePath(`/members/${memberId}`);
  redirect(`/members/${memberId}?ok=Re-opted%20in`);
}

export async function markRead(conversationId: string) {
  await requireCapability("messaging.read");
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unread: false },
  });
  revalidatePath("/messages");
}
