import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateBearer, hasScope } from "@/lib/mcp/auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasScope(auth.ctx, ["members.read"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (auth.ctx.user.role === "MEMBER" && auth.ctx.user.memberId !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      addresses: true,
      dependents: true,
      groupMemberships: { include: { group: { select: { id: true, name: true } } } },
      committeeMemberships: {
        include: { committee: { select: { id: true, name: true } } },
      },
    },
  });
  if (!member || member.deletedAt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(member);
}
