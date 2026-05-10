import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const user = await prisma.user.findUnique({ where: { passToken: token } });
  if (!user) return new NextResponse("not found", { status: 404 });

  const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/checkin/${token}`;
  const png = await QRCode.toBuffer(url, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(png as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
