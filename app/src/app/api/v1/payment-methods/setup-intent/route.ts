import { z } from "zod";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api/v1";
import { createSetupIntent } from "@/lib/payments/setupIntent";

export const runtime = "nodejs";

export const POST = withApi({
  scopes: ["finance.read"],
  source: "json",
  inputSchema: z.object({
    memberId: z.string().optional(),
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
      ctx.user.role !== "ADMIN" &&
      ctx.user.role !== "STAFF" &&
      member?.user?.id !== ctx.user.id
    ) {
      return { error: "forbidden" };
    }

    const { clientSecret } = await createSetupIntent(memberId);
    return {
      clientSecret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
    };
  },
});
