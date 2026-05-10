import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeTool, textResult, type Tool } from "../types";

const listGroups = makeTool({
  name: "groups.list",
  description: "List active groups (interest groups, committees, sections).",
  required: ["groups.read"],
  inputSchema: z.object({}),
  async handler() {
    const groups = await prisma.group.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { memberships: true } } },
    });
    return textResult(`${groups.length} groups.`, groups);
  },
});

const listCommittees = makeTool({
  name: "committees.list",
  description: "List active committees.",
  required: ["committees.read"],
  inputSchema: z.object({}),
  async handler() {
    const committees = await prisma.committee.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { memberships: true } } },
    });
    return textResult(`${committees.length} committees.`, committees);
  },
});

export const orgTools: Tool[] = [
  listGroups as unknown as Tool,
  listCommittees as unknown as Tool,
];
