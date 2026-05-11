import { z } from "zod";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api/v1";
import { createCustomerPortalSession } from "@/lib/payments/portal";

export const runtime = "nodejs";

export const POST = withApi({
  scopes: ["finance.read"],
  source: "json",
  inputSchema: z.object({
    memberId: z.string().optional(),
    returnUrl: z.string().url().optional(),
  }),
  async handler(input, ctx) {
    const memberId =
      ctx.user.role === "MEMBER" && ctx.user.memberId
        ? ctx.user.memberId
        : input.memberId;
    if (!memberId) return { error: "memberId_required" };

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { user: { select: { id: true } } },
    });
    if (
      ctx.user.role === "MEMBER" &&
      member?.user?.id !== ctx.user.id
    ) {
      return { error: "forbidden" };
    }

    const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
    const portal = await createCustomerPortalSession({
      memberId,
      returnUrl: input.returnUrl ?? `${baseUrl}/members/${memberId}/payment-methods`,
    });
    return { url: portal.url };
  },
});
