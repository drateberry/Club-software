import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateBearer, hasScope } from "@/lib/mcp/auth";
import { logAudit } from "@/lib/audit";
import { sendMessage, OptedOutError, TwilioNotConfiguredError } from "@/lib/twilio/send";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasScope(auth.ctx, ["messaging.read"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, firstName: true, lastName: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 500 },
    },
  });
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(conversation);
}

const sendSchema = z.object({ body: z.string().min(1).max(1600) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasScope(auth.ctx, ["messaging.write"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await sendMessage({
      toPhone: conversation.phone,
      body: parsed.data.body,
      sentById: auth.ctx.user.id,
      memberId: conversation.memberId,
    });
    await logAudit(auth.ctx.user.id, "message.send", "Conversation", conversation.id, {
      source: "api/v1",
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OptedOutError) {
      return NextResponse.json({ error: "opted_out" }, { status: 409 });
    }
    if (err instanceof TwilioNotConfiguredError) {
      return NextResponse.json({ error: "twilio_not_configured" }, { status: 503 });
    }
    throw err;
  }
}
