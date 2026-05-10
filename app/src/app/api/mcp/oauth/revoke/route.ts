import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/mcp/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const token = params.get("token");
  if (!token) return new NextResponse(null, { status: 200 });

  await prisma.mCPToken.updateMany({
    where: { tokenHash: hashToken(token) },
    data: { revokedAt: new Date() },
  });

  return new NextResponse(null, { status: 200 });
}
