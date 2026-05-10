import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeTool, textResult, type Tool } from "../types";

const listMembers = makeTool({
  name: "members.list",
  title: "List members",
  description:
    "List members in the club, ordered by last name. When called by a member-scoped token, only that member is returned.",
  required: ["members.read"],
  inputSchema: z.object({
    search: z.string().max(100).optional(),
    membershipStatus: z
      .enum(["ACTIVE", "SUSPENDED", "RESIGNED", "DECEASED"])
      .optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async handler(input, ctx) {
    const baseWhere = ctx.user.role === "MEMBER" && ctx.user.memberId
      ? { id: ctx.user.memberId }
      : { deletedAt: null };

    const members = await prisma.member.findMany({
      where: {
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
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: input.limit,
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
      },
    });
    return textResult(`Found ${members.length} members.`, members);
  },
});

const getMember = makeTool({
  name: "members.get",
  description: "Fetch a single member by ID, including addresses, dependents, and active memberships.",
  required: ["members.read"],
  inputSchema: z.object({
    memberId: z.string().min(1),
  }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER" && ctx.user.memberId !== input.memberId) {
      return textResult("Not found.", null);
    }
    const member = await prisma.member.findUnique({
      where: { id: input.memberId },
      include: {
        addresses: true,
        dependents: true,
        groupMemberships: { include: { group: { select: { name: true } } } },
        committeeMemberships: {
          include: { committee: { select: { name: true } } },
        },
      },
    });
    if (!member || member.deletedAt) {
      return textResult("Member not found.", null);
    }
    return textResult(`${member.firstName} ${member.lastName}`, member);
  },
});

export const memberTools: Tool[] = [
  listMembers as unknown as Tool,
  getMember as unknown as Tool,
];
