import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/api/openapi";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.CLUB_PUBLIC_URL ?? `${url.protocol}//${url.host}`;
  const spec = buildOpenApiSpec(base);
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
