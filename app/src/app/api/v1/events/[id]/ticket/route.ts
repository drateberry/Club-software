import { NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authenticateBearer, hasScope } from "@/lib/mcp/auth";
import { getPaymentProvider } from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasScope(auth.ctx, ["events.read"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!auth.ctx.user.memberId) {
    return NextResponse.json({ error: "no_linked_member" }, { status: 400 });
  }

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!event.isTicketed) {
    return NextResponse.json({ error: "not_ticketed" }, { status: 400 });
  }

  let attendanceId: string;
  try {
    await prisma.$transaction(async (tx) => {
      if (event.capacity) {
        await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
        const ticketed = await tx.eventAttendance.count({
          where: { eventId, ticketPaidAt: { not: null } },
        });
        if (ticketed >= event.capacity) throw new Error("sold_out");
      }
      const attendance = await tx.eventAttendance.upsert({
        where: { eventId_memberId: { eventId, memberId: auth.ctx.user.memberId! } },
        create: {
          eventId,
          memberId: auth.ctx.user.memberId!,
          status: AttendanceStatus.GOING,
        },
        update: { status: AttendanceStatus.GOING },
      });
      attendanceId = attendance.id;
    });
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json(
      { error: msg === "sold_out" ? "sold_out" : "ticket_failed", error_description: msg },
      { status: 400 }
    );
  }

  const provider = getPaymentProvider();
  const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
  const link = await provider.createPaymentLink({
    description: `${event.title} — ticket`,
    amountCents: event.memberPriceCents,
    currency: process.env.CLUB_CURRENCY ?? "USD",
    metadata: { attendanceId: attendanceId!, eventId },
    successUrl: `${baseUrl}/events/${eventId}?ok=Ticket%20purchased`,
    cancelUrl: `${baseUrl}/events/${eventId}?err=Purchase%20cancelled`,
    customerEmail: auth.ctx.user.email,
  });
  return NextResponse.json({ checkoutUrl: link.url, providerPaymentId: link.providerPaymentId });
}
