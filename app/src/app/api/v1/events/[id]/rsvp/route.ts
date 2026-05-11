import { NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateBearer, hasScope } from "@/lib/mcp/auth";

export const runtime = "nodejs";

const rsvpSchema = z.object({
  status: z.nativeEnum(AttendanceStatus).default(AttendanceStatus.GOING),
});

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
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty body */
  }
  const parsed = rsvpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const status = parsed.data.status;
  const memberId = auth.ctx.user.memberId;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id: eventId } });
      if (!event) throw new Error("Event not found");
      if (status === AttendanceStatus.GOING && event.capacity) {
        const going = await tx.eventAttendance.count({
          where: { eventId, status: AttendanceStatus.GOING },
        });
        const existing = await tx.eventAttendance.findUnique({
          where: { eventId_memberId: { eventId, memberId } },
        });
        const wasGoing = existing?.status === AttendanceStatus.GOING;
        const projected = going + (wasGoing ? 0 : 1);
        if (projected > event.capacity) throw new Error("Event is full");
      }
      await tx.eventAttendance.upsert({
        where: { eventId_memberId: { eventId, memberId } },
        create: { eventId, memberId, status },
        update: { status },
      });
    });
  } catch (err) {
    return NextResponse.json(
      { error: "rsvp_failed", error_description: (err as Error).message },
      { status: 400 }
    );
  }

  return NextResponse.json({ eventId, memberId, status });
}
