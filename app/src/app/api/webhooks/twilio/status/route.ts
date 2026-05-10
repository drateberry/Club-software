import { NextResponse } from "next/server";
import twilio from "twilio";
import { MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTwilioConfig } from "@/lib/twilio/client";

export const runtime = "nodejs";

const STATUS_MAP: Record<string, MessageStatus> = {
  queued: MessageStatus.QUEUED,
  sending: MessageStatus.SENT,
  sent: MessageStatus.SENT,
  delivered: MessageStatus.DELIVERED,
  undelivered: MessageStatus.FAILED,
  failed: MessageStatus.FAILED,
};

export async function POST(req: Request) {
  const config = await getTwilioConfig();
  if (!config) return new NextResponse(null, { status: 204 });

  const bodyText = await req.text();
  const params = new URLSearchParams(bodyText);
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const url = req.headers.get("x-forwarded-host")
    ? `https://${req.headers.get("x-forwarded-host")}${new URL(req.url).pathname}`
    : req.url;
  const valid = twilio.validateRequest(
    config.authToken,
    signature,
    url,
    Object.fromEntries(params.entries())
  );
  if (!valid && process.env.NODE_ENV === "production") {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const sid = params.get("MessageSid") ?? params.get("SmsSid") ?? "";
  const status = (params.get("MessageStatus") ?? "").toLowerCase();
  if (!sid || !status) return new NextResponse(null, { status: 204 });

  const mapped = STATUS_MAP[status];
  if (!mapped) return new NextResponse(null, { status: 204 });

  await prisma.message.updateMany({
    where: { twilioSid: sid },
    data: {
      status: mapped,
      deliveredAt: mapped === MessageStatus.DELIVERED ? new Date() : undefined,
      errorCode: params.get("ErrorCode") ?? undefined,
      errorMessage: params.get("ErrorMessage") ?? undefined,
    },
  });

  return new NextResponse(null, { status: 204 });
}
