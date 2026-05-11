import { z } from "zod";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api/v1";

export const runtime = "nodejs";

export const GET = withApi({
  scopes: ["events.read"],
  source: "query",
  inputSchema: z.object({
    upcoming: z.coerce.boolean().default(true),
    limit: z.coerce.number().int().min(1).max(200).default(50),
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
    return { data: events };
  },
});
