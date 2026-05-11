import { z } from "zod";
import { prisma } from "@/lib/db";
import { effectiveCapabilities, type Capability } from "@/lib/capabilities";
import { withApi } from "@/lib/api/v1";

export const runtime = "nodejs";

export const GET = withApi({
  scopes: [],
  source: "none",
  inputSchema: z.object({}),
  async handler(_input, ctx) {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            memberNumber: true,
            email: true,
            phone: true,
            membershipClass: true,
            membershipStatus: true,
          },
        },
      },
    });
    if (!user) {
      return { error: "user_not_found" };
    }

    const effective = effectiveCapabilities(user.role, (user.capabilities ?? []) as Capability[]);
    const grantedScopes = ctx.scopes;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      capabilities: effective,
      tokenScopes: grantedScopes,
      member: user.member,
      passToken: user.passToken,
      clubName: process.env.CLUB_NAME ?? "Club OS",
      currency: process.env.CLUB_CURRENCY ?? "USD",
      locale: process.env.CLUB_LOCALE ?? "en-US",
      timezone: process.env.CLUB_TIMEZONE ?? "America/New_York",
    };
  },
});
