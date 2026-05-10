import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendMessage, OptedOutError, TwilioNotConfiguredError } from "@/lib/twilio/send";
import { bulkSendToMembers } from "@/lib/twilio/bulk";
import { toE164 } from "@/lib/twilio/normalize";
import { makeTool, textResult, errorResult, type Tool } from "../types";

const sendToMember = makeTool({
  name: "messaging.send_to_member",
  description: "Send an SMS to a member by ID using their phone on file. Skips opted-out recipients.",
  required: ["messaging.write"],
  inputSchema: z.object({
    memberId: z.string().min(1),
    body: z.string().min(1).max(1600),
  }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot send SMS");
    const member = await prisma.member.findUnique({
      where: { id: input.memberId },
      select: { phone: true, twilioOptedOut: true },
    });
    if (!member?.phone) return errorResult("Member has no phone");
    if (member.twilioOptedOut) return errorResult("Member has opted out of texts");
    const e164 = toE164(member.phone);
    if (!e164) return errorResult("Phone number could not be parsed");

    try {
      const result = await sendMessage({
        toPhone: e164,
        body: input.body,
        sentById: ctx.user.id,
        memberId: input.memberId,
      });
      await logAudit(ctx.user.id, "message.send", "Member", input.memberId, {
        source: "mcp",
        bodyLength: input.body.length,
      });
      return textResult(`Sent (sid=${result.twilioSid}).`, result);
    } catch (err) {
      if (err instanceof OptedOutError) return errorResult("Recipient has opted out");
      if (err instanceof TwilioNotConfiguredError) return errorResult("Twilio is not configured");
      throw err;
    }
  },
});

const bulkSend = makeTool({
  name: "messaging.bulk_send",
  description: "Send the same SMS to a list of member IDs. Skips no-phone and opted-out recipients.",
  required: ["messaging.bulkSend"],
  inputSchema: z.object({
    memberIds: z.array(z.string().min(1)).min(1).max(500),
    body: z.string().min(1).max(1600),
  }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot bulk-send");
    const result = await bulkSendToMembers({
      memberIds: input.memberIds,
      body: input.body,
      sentById: ctx.user.id,
    });
    await logAudit(ctx.user.id, "message.bulkSend", "Member", input.memberIds.join(","), {
      source: "mcp",
      ...result,
    });
    return textResult(
      `Queued ${result.enqueued} of ${result.total} (no_phone=${result.skippedNoPhone}, opted_out=${result.skippedOptedOut}).`,
      result
    );
  },
});

export const messagingWriteTools: Tool[] = [
  sendToMember as unknown as Tool,
  bulkSend as unknown as Tool,
];
