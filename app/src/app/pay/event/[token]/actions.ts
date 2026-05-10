"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";

const guestSchema = z.object({
  guestName: z.string().min(1).max(200),
  guestEmail: z.string().email(),
});

export async function buyGuestTicket(token: string, formData: FormData) {
  const event = await prisma.event.findUnique({ where: { publicToken: token } });
  if (!event || event.deletedAt) {
    redirect(`/pay/event/${token}?err=Event%20not%20found`);
  }
  if (!event.isTicketed) {
    redirect(`/pay/event/${token}?err=This%20event%20is%20not%20ticketed`);
  }

  const parsed = guestSchema.parse({
    guestName: formData.get("guestName"),
    guestEmail: formData.get("guestEmail"),
  });

  let attendanceId: string;
  await prisma.$transaction(async (tx) => {
    if (event.capacity) {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${event.id} FOR UPDATE`;
      const ticketed = await tx.eventAttendance.count({
        where: { eventId: event.id, ticketPaidAt: { not: null } },
      });
      if (ticketed >= event.capacity) {
        throw new Error("Event is sold out");
      }
    }

    const attendance = await tx.eventAttendance.create({
      data: {
        eventId: event.id,
        guestName: parsed.guestName,
        guestEmail: parsed.guestEmail,
        status: AttendanceStatus.GOING,
      },
    });
    attendanceId = attendance.id;
  });

  const provider = getPaymentProvider();
  const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
  const result = await provider.createPaymentLink({
    description: `${event.title} — guest ticket`,
    amountCents: event.guestPriceCents || event.memberPriceCents,
    currency: process.env.CLUB_CURRENCY ?? "USD",
    metadata: { attendanceId: attendanceId!, eventId: event.id },
    successUrl: `${baseUrl}/pay/event/${token}?status=success`,
    cancelUrl: `${baseUrl}/pay/event/${token}?status=cancel`,
    customerEmail: parsed.guestEmail,
  });

  redirect(result.url);
}
