import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeTool, textResult, type Tool } from "../types";

const listEvents = makeTool({
  name: "events.list",
  description: "List upcoming events. Returns title, time, venue, capacity, and ticket pricing.",
  required: ["events.read"],
  inputSchema: z.object({
    upcoming: z.boolean().default(true),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async handler(input) {
    const events = await prisma.event.findMany({
      where: {
        deletedAt: null,
        ...(input.upcoming ? { startAt: { gte: new Date() } } : {}),
      },
      orderBy: { startAt: "asc" },
      take: input.limit,
      include: {
        _count: { select: { attendances: true } },
      },
    });
    return textResult(`${events.length} events.`, events);
  },
});

const getEvent = makeTool({
  name: "events.get",
  description: "Fetch event detail with attendee roster.",
  required: ["events.read"],
  inputSchema: z.object({ eventId: z.string().min(1) }),
  async handler(input) {
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      include: {
        attendances: { include: { member: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!event || event.deletedAt) return textResult("Event not found.", null);
    return textResult(event.title, event);
  },
});

export const eventTools: Tool[] = [
  listEvents as unknown as Tool,
  getEvent as unknown as Tool,
];
