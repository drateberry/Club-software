import { z } from "zod";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api/v1";

export const runtime = "nodejs";

export const GET = withApi({
  scopes: ["messaging.read"],
  source: "query",
  inputSchema: z.object({
    unreadOnly: z.coerce.boolean().default(false),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
  async handler(input) {
    const conversations = await prisma.conversation.findMany({
      where: input.unreadOnly ? { unread: true } : {},
      orderBy: { lastMessageAt: "desc" },
      take: input.limit,
      include: {
        member: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
        _count: { select: { messages: true } },
      },
    });
    return { data: conversations };
  },
});
