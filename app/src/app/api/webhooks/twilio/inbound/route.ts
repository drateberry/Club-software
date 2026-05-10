import { NextResponse } from "next/server";
import twilio from "twilio";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTwilioConfig } from "@/lib/twilio/client";
import { handleInbound } from "@/lib/twilio/inbound";

export const runtime = "nodejs";

function twiml(reply: string | null): string {
  if (!reply) return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>";
  const escaped = reply
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

export async function POST(req: Request) {
  const config = await getTwilioConfig();
  if (!config) {
    return new NextResponse(twiml(null), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const bodyText = await req.text();
  const params = new URLSearchParams(bodyText);
  const url = req.headers.get("x-forwarded-host")
    ? `https://${req.headers.get("x-forwarded-host")}${new URL(req.url).pathname}`
    : req.url;
  const signature = req.headers.get("x-twilio-signature") ?? "";

  const valid = twilio.validateRequest(
    config.authToken,
    signature,
    url,
    Object.fromEntries(params.entries())
  );
  if (!valid && process.env.NODE_ENV === "production") {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const sid = params.get("MessageSid") ?? params.get("SmsMessageSid") ?? "";
  if (!sid) {
    return new NextResponse(twiml(null), { headers: { "Content-Type": "text/xml" } });
  }

  const existing = await prisma.webhookEvent.findUnique({
    where: {
      providerName_providerEventId: {
        providerName: "twilio",
        providerEventId: sid,
      },
    },
  });
  if (existing?.processedAt) {
    return new NextResponse(twiml(null), { headers: { "Content-Type": "text/xml" } });
  }
  const stored =
    existing ??
    (await prisma.webhookEvent.create({
      data: {
        providerName: "twilio",
        providerEventId: sid,
        rawJson: Object.fromEntries(params.entries()) as unknown as Prisma.InputJsonValue,
      },
    }));

  const numMedia = Number.parseInt(params.get("NumMedia") ?? "0", 10) || 0;
  const mediaUrls: string[] = [];
  for (let i = 0; i < numMedia; i++) {
    const url = params.get(`MediaUrl${i}`);
    if (url) mediaUrls.push(url);
  }

  const outcome = await handleInbound({
    fromPhone: params.get("From") ?? "",
    body: params.get("Body"),
    twilioSid: sid,
    mediaUrls,
  });

  await prisma.webhookEvent.update({
    where: { id: stored.id },
    data: { processedAt: new Date() },
  });

  if ("error" in outcome) {
    return new NextResponse(twiml(null), { headers: { "Content-Type": "text/xml" } });
  }

  return new NextResponse(twiml(outcome.reply), {
    headers: { "Content-Type": "text/xml" },
  });
}
