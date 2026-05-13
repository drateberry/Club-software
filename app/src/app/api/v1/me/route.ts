import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateBearer, hasScope } from "@/lib/mcp/auth";
import { effectiveCapabilities, type Capability } from "@/lib/capabilities";
import { withApi } from "@/lib/api/v1";
import { logAudit } from "@/lib/audit";
import { memberChanged } from "@/lib/mcp/events";
import { consume, rateLimitHeaders } from "@/lib/api/rateLimit";

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

const patchSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().max(50).optional(),
});

export async function PATCH(req: Request) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasScope(auth.ctx, [])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const limit = consume(`u:${auth.ctx.user.id}`, "write");
  if (!limit.allowed) {
    return new NextResponse(
      JSON.stringify({ error: "rate_limited" }),
      { status: 429, headers: { "Content-Type": "application/json", ...rateLimitHeaders(limit) } }
    );
  }
  if (!auth.ctx.user.memberId) {
    return NextResponse.json({ error: "no_linked_member" }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }

  const data: Record<string, string | null> = {};
  if (parsed.data.firstName !== undefined) data.firstName = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) data.lastName = parsed.data.lastName;
  if (parsed.data.email !== undefined) data.email = parsed.data.email || null;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null;

  const member = await prisma.member.update({
    where: { id: auth.ctx.user.memberId },
    data,
  });

  await logAudit(auth.ctx.user.id, "member.update", "Member", auth.ctx.user.memberId, {
    source: "api/v1.me.patch",
    fields: Object.keys(data),
  });
  memberChanged(auth.ctx.user.memberId);

  return NextResponse.json(member, { headers: rateLimitHeaders(limit) });
}
