import { z } from "zod";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api/v1";

export const runtime = "nodejs";

export const GET = withApi({
  scopes: ["members.read"],
  source: "query",
  inputSchema: z.object({
    search: z.string().max(100).optional(),
    membershipStatus: z
      .enum(["ACTIVE", "SUSPENDED", "RESIGNED", "DECEASED"])
      .optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    cursor: z.string().optional(),
  }),
  async handler(input, ctx) {
    const baseWhere =
      ctx.user.role === "MEMBER" && ctx.user.memberId
        ? { id: ctx.user.memberId }
        : { deletedAt: null };

    const where = {
      ...baseWhere,
      ...(input.search
        ? {
            OR: [
              { firstName: { contains: input.search, mode: "insensitive" as const } },
              { lastName: { contains: input.search, mode: "insensitive" as const } },
              { email: { contains: input.search, mode: "insensitive" as const } },
              { memberNumber: { contains: input.search } },
            ],
          }
        : {}),
      ...(input.membershipStatus ? { membershipStatus: input.membershipStatus } : {}),
    };

    const limit = input.limit ?? 50;
    const members = await prisma.member.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        memberNumber: true,
        membershipClass: true,
        membershipStatus: true,
        joinDate: true,
        twilioOptedOut: true,
      },
    });

    const hasMore = members.length > limit;
    const page = hasMore ? members.slice(0, limit) : members;
    return {
      data: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  },
});
