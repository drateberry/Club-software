import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateBearer, hasScope } from "@/lib/mcp/auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasScope(auth.ctx, ["finance.read"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      member: true,
      lines: true,
      installments: { orderBy: { sequence: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (auth.ctx.user.role === "MEMBER" && auth.ctx.user.memberId !== invoice.memberId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
  return NextResponse.json({
    ...invoice,
    paymentUrl: `${baseUrl}/pay/${invoice.paymentToken}`,
  });
}
