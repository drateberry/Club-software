import { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueueTriggered } from "@/lib/twilio/triggers";
import { eventChanged } from "@/lib/mcp/events";
import { formatDate } from "@/lib/format";

/**
 * Inside a transaction, promote the oldest WAITLIST attendee for an event
 * to GOING if the event has capacity room. Returns the promoted
 * attendance (if any). Capacity is locked via SELECT … FOR UPDATE so this
 * is safe under concurrent cancellations.
 */
export async function promoteFromWaitlist(eventId: string): Promise<{
  promotedMemberId: string;
  eventTitle: string;
  eventStartAt: Date;
} | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) return null;
    if (!event.capacity) return null;

    const going = await tx.eventAttendance.count({
      where: { eventId, status: AttendanceStatus.GOING },
    });
    if (going >= event.capacity) return null;

    const next = await tx.eventAttendance.findFirst({
      where: { eventId, status: AttendanceStatus.WAITLIST },
      orderBy: { createdAt: "asc" },
    });
    if (!next?.memberId) return null;

    await tx.eventAttendance.update({
      where: { id: next.id },
      data: { status: AttendanceStatus.GOING },
    });

    return {
      promotedMemberId: next.memberId,
      eventTitle: event.title,
      eventStartAt: event.startAt,
    };
  }).then(async (result) => {
    if (!result) return null;
    await enqueueTriggered("waitlist.promoted", {
      memberId: result.promotedMemberId,
      vars: {
        event_title: result.eventTitle,
        event_date: formatDate(result.eventStartAt),
      },
    });
    eventChanged(eventId);
    return result;
  });
}

/**
 * Get the 1-indexed waitlist position for a member on an event, or null
 * if they're not on the waitlist.
 */
export async function waitlistPositionFor(
  eventId: string,
  memberId: string
): Promise<number | null> {
  const list = await prisma.eventAttendance.findMany({
    where: { eventId, status: AttendanceStatus.WAITLIST },
    orderBy: { createdAt: "asc" },
    select: { memberId: true },
  });
  const idx = list.findIndex((a) => a.memberId === memberId);
  return idx === -1 ? null : idx + 1;
}

export async function waitlistCount(eventId: string): Promise<number> {
  return prisma.eventAttendance.count({
    where: { eventId, status: AttendanceStatus.WAITLIST },
  });
}
