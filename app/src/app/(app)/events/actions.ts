"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession, requireCapability } from "@/lib/guards";
import { getPaymentProvider } from "@/lib/payments";
import { enqueueTriggered } from "@/lib/twilio/triggers";
import { eventChanged } from "@/lib/mcp/events";
import { formatDate } from "@/lib/format";

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  venue: z.string().max(200).optional().or(z.literal("")),
  capacity: z.string().optional().or(z.literal("")),
  isTicketed: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  memberPrice: z.string().optional().or(z.literal("")),
  guestPrice: z.string().optional().or(z.literal("")),
  rsvpDeadline: z.string().optional().or(z.literal("")),
});

function dollarsToCents(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export async function createEvent(formData: FormData) {
  await requireCapability("events.write");
  const parsed = eventSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    venue: formData.get("venue") ?? "",
    capacity: formData.get("capacity") ?? "",
    isTicketed: formData.get("isTicketed"),
    memberPrice: formData.get("memberPrice") ?? "",
    guestPrice: formData.get("guestPrice") ?? "",
    rsvpDeadline: formData.get("rsvpDeadline") ?? "",
  });

  const event = await prisma.event.create({
    data: {
      title: parsed.title,
      description: parsed.description || null,
      startAt: new Date(parsed.startAt),
      endAt: new Date(parsed.endAt),
      venue: parsed.venue || null,
      capacity: parsed.capacity ? Number.parseInt(parsed.capacity, 10) : null,
      isTicketed: parsed.isTicketed,
      memberPriceCents: dollarsToCents(parsed.memberPrice),
      guestPriceCents: dollarsToCents(parsed.guestPrice),
      rsvpDeadline: parsed.rsvpDeadline ? new Date(parsed.rsvpDeadline) : null,
    },
  });

  revalidatePath("/events");
  redirect(`/events/${event.id}?ok=Event%20created`);
}

const rsvpSchema = z.object({
  status: z.nativeEnum(AttendanceStatus),
});

/**
 * RSVP for a logged-in member. Capacity is enforced under a transaction with
 * SELECT ... FOR UPDATE to prevent oversubscription under concurrent writes.
 */
export async function rsvp(eventId: string, formData: FormData) {
  const session = await requireSession();
  const { status } = rsvpSchema.parse({ status: formData.get("status") });

  const memberId = (
    await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { memberId: true },
    })
  )?.memberId;

  if (!memberId) {
    redirect(`/events/${eventId}?err=Your%20user%20is%20not%20linked%20to%20a%20member`);
  }

  await prisma.$transaction(async (tx) => {
    const [event] = await tx.$queryRaw<
      Array<{ id: string; capacity: number | null }>
    >`SELECT id, capacity FROM "Event" WHERE id = ${eventId} FOR UPDATE`;

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
      if (projected > event.capacity) {
        throw new Error("Event is full");
      }
    }

    await tx.eventAttendance.upsert({
      where: { eventId_memberId: { eventId, memberId } },
      create: { eventId, memberId, status },
      update: { status },
    });
  });

  if (status === AttendanceStatus.GOING) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (event) {
      await enqueueTriggered("rsvp.confirmed", {
        memberId,
        vars: {
          event_title: event.title,
          event_date: formatDate(event.startAt),
        },
      });
    }
  }

  eventChanged(eventId);
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}?ok=RSVP%20saved`);
}

export async function buyTicket(eventId: string) {
  const session = await requireSession();
  const memberId = (
    await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { memberId: true },
    })
  )?.memberId;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  if (!event.isTicketed) throw new Error("Event is not ticketed");

  let attendanceId: string;
  await prisma.$transaction(async (tx) => {
    if (event.capacity) {
      const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
      if (!locked) throw new Error("Event not found");

      const ticketed = await tx.eventAttendance.count({
        where: { eventId, ticketPaidAt: { not: null } },
      });
      if (ticketed >= event.capacity) throw new Error("Event is sold out");
    }

    const attendance = await tx.eventAttendance.upsert({
      where: memberId
        ? { eventId_memberId: { eventId, memberId } }
        : { eventId_memberId: { eventId, memberId: "" } },
      create: { eventId, memberId, status: AttendanceStatus.GOING },
      update: { status: AttendanceStatus.GOING },
    });
    attendanceId = attendance.id;
  });

  const provider = getPaymentProvider();
  const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
  const result = await provider.createPaymentLink({
    description: `${event.title} — ticket`,
    amountCents: event.memberPriceCents,
    currency: process.env.CLUB_CURRENCY ?? "USD",
    metadata: { attendanceId: attendanceId!, eventId },
    successUrl: `${baseUrl}/events/${eventId}?ok=Ticket%20purchased`,
    cancelUrl: `${baseUrl}/events/${eventId}?err=Purchase%20cancelled`,
    enableAch: false,
    customerEmail: session.user.email ?? undefined,
  });

  redirect(result.url);
}
