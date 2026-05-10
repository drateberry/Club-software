import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { makeTool, textResult, errorResult, type Tool } from "../types";

const createEvent = makeTool({
  name: "events.create",
  description: "Create a new event.",
  required: ["events.write"],
  inputSchema: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    startAt: z.string(),
    endAt: z.string(),
    venue: z.string().max(200).optional(),
    capacity: z.number().int().min(0).optional(),
    isTicketed: z.boolean().default(false),
    memberPriceCents: z.number().int().min(0).default(0),
    guestPriceCents: z.number().int().min(0).default(0),
  }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot create events");
    const event = await prisma.event.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        venue: input.venue ?? null,
        capacity: input.capacity ?? null,
        isTicketed: input.isTicketed ?? false,
        memberPriceCents: input.memberPriceCents ?? 0,
        guestPriceCents: input.guestPriceCents ?? 0,
      },
    });
    await logAudit(ctx.user.id, "event.create", "Event", event.id, { source: "mcp" });
    return textResult(`Created event "${event.title}".`, event);
  },
});

const rsvpEvent = makeTool({
  name: "events.rsvp",
  description: "RSVP to an event. Member-scoped tokens RSVP for themselves.",
  required: ["events.read"],
  inputSchema: z.object({
    eventId: z.string().min(1),
    memberId: z.string().optional(),
    status: z.nativeEnum(AttendanceStatus).default(AttendanceStatus.GOING),
  }),
  async handler(input, ctx) {
    const memberId =
      ctx.user.role === "MEMBER" ? ctx.user.memberId : input.memberId ?? ctx.user.memberId;
    if (!memberId) return errorResult("memberId required");

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${input.eventId} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id: input.eventId } });
      if (!event) throw new Error("Event not found");

      if (
        (input.status ?? AttendanceStatus.GOING) === AttendanceStatus.GOING &&
        event.capacity
      ) {
        const going = await tx.eventAttendance.count({
          where: { eventId: input.eventId, status: AttendanceStatus.GOING },
        });
        const existing = await tx.eventAttendance.findUnique({
          where: { eventId_memberId: { eventId: input.eventId, memberId } },
        });
        const wasGoing = existing?.status === AttendanceStatus.GOING;
        const projected = going + (wasGoing ? 0 : 1);
        if (projected > event.capacity) throw new Error("Event is full");
      }

      await tx.eventAttendance.upsert({
        where: { eventId_memberId: { eventId: input.eventId, memberId } },
        create: { eventId: input.eventId, memberId, status: input.status ?? AttendanceStatus.GOING },
        update: { status: input.status ?? AttendanceStatus.GOING },
      });
    });

    return textResult(`RSVP saved (${input.status ?? "GOING"}).`, {
      eventId: input.eventId,
      memberId,
      status: input.status ?? "GOING",
    });
  },
});

export const eventWriteTools: Tool[] = [
  createEvent as unknown as Tool,
  rsvpEvent as unknown as Tool,
];
