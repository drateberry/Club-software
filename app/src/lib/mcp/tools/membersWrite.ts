import { z } from "zod";
import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { makeTool, textResult, errorResult, type Tool } from "../types";

const createMember = makeTool({
  name: "members.create",
  description: "Create a new member. Required: firstName, lastName.",
  required: ["members.write"],
  inputSchema: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    memberNumber: z.string().max(50).optional(),
    membershipClass: z.string().max(50).optional(),
  }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot create new members");
    const member = await prisma.member.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        memberNumber: input.memberNumber ?? null,
        membershipClass: input.membershipClass ?? null,
      },
    });
    await logAudit(ctx.user.id, "member.create", "Member", member.id, { source: "mcp" });
    return textResult(`Created ${member.firstName} ${member.lastName}.`, member);
  },
});

const updateMember = makeTool({
  name: "members.update",
  description: "Update a member by ID. Pass only the fields you want to change.",
  required: ["members.write"],
  inputSchema: z.object({
    memberId: z.string().min(1),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    email: z.string().email().or(z.literal("")).optional(),
    phone: z.string().max(50).optional(),
    membershipClass: z.string().max(50).optional(),
    membershipStatus: z.nativeEnum(MembershipStatus).optional(),
  }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER" && ctx.user.memberId !== input.memberId) {
      return errorResult("Members can only update their own profile");
    }
    const member = await prisma.member.update({
      where: { id: input.memberId },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.membershipClass !== undefined ? { membershipClass: input.membershipClass || null } : {}),
        ...(input.membershipStatus !== undefined ? { membershipStatus: input.membershipStatus } : {}),
      },
    });
    await logAudit(ctx.user.id, "member.update", "Member", member.id, { source: "mcp" });
    return textResult(`Updated ${member.firstName} ${member.lastName}.`, member);
  },
});

const deleteMember = makeTool({
  name: "members.delete",
  description: "Soft-delete a member (sets deletedAt). Requires members.write.",
  required: ["members.write"],
  inputSchema: z.object({ memberId: z.string().min(1) }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot delete members");
    await prisma.member.update({
      where: { id: input.memberId },
      data: { deletedAt: new Date() },
    });
    await logAudit(ctx.user.id, "member.delete", "Member", input.memberId, { source: "mcp" });
    return textResult("Deleted.", { memberId: input.memberId });
  },
});

export const memberWriteTools: Tool[] = [
  createMember as unknown as Tool,
  updateMember as unknown as Tool,
  deleteMember as unknown as Tool,
];
