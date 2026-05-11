import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withApi } from "@/lib/api/v1";

export const runtime = "nodejs";

export const GET = withApi({
  scopes: ["checkin.scan"],
  source: "query",
  inputSchema: z.object({
    sinceHours: z.coerce.number().int().min(1).max(168).default(24),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
  async handler(input) {
    const sinceHours = input.sinceHours ?? 24;
    const limit = input.limit ?? 50;
    const since = new Date();
    since.setHours(since.getHours() - sinceHours);
    const logs = await prisma.checkinLog.findMany({
      where: { scannedAt: { gte: since } },
      orderBy: { scannedAt: "desc" },
      take: limit,
      include: { member: { select: { id: true, firstName: true, lastName: true, memberNumber: true, membershipStatus: true } } },
    });
    return { data: logs };
  },
});

export const POST = withApi({
  scopes: ["checkin.scan"],
  source: "json",
  inputSchema: z.object({
    passToken: z.string().optional(),
    memberId: z.string().optional(),
    note: z.string().max(200).optional(),
  }),
  async handler(input, ctx) {
    let memberId = input.memberId;
    if (!memberId && input.passToken) {
      const user = await prisma.user.findUnique({
        where: { passToken: input.passToken },
        select: { memberId: true },
      });
      memberId = user?.memberId ?? undefined;
    }
    if (!memberId) {
      return { error: "no_member_resolved" };
    }
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { membershipStatus: true, firstName: true, lastName: true },
    });
    if (!member) return { error: "member_not_found" };
    if (member.membershipStatus !== "ACTIVE") {
      return {
        warning: "not_active",
        membershipStatus: member.membershipStatus,
        memberName: `${member.firstName} ${member.lastName}`,
      };
    }
    const log = await prisma.checkinLog.create({
      data: { memberId, notes: input.note ?? null },
    });
    await logAudit(ctx.user.id, "checkin.log", "CheckinLog", log.id, {
      source: "api/v1",
    });
    return {
      ok: true,
      log,
      memberName: `${member.firstName} ${member.lastName}`,
    };
  },
});
