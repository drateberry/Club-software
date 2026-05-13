import { NextResponse } from "next/server";
import { authenticateBearer, hasScope } from "@/lib/mcp/auth";
import { consume, rateLimitHeaders } from "@/lib/api/rateLimit";
import { logAudit } from "@/lib/audit";
import { getExporter } from "@/lib/csv/exporters";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { entity } = await params;
  const exporter = getExporter(entity);
  if (!exporter) {
    return NextResponse.json({ error: "unknown_entity" }, { status: 404 });
  }
  if (!hasScope(auth.ctx, exporter.scopes)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (auth.ctx.user.role === "MEMBER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const limit = consume(`u:${auth.ctx.user.id}`, "strict");
  if (!limit.allowed) {
    return new NextResponse(
      JSON.stringify({ error: "rate_limited" }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", ...rateLimitHeaders(limit) },
      }
    );
  }

  await logAudit(auth.ctx.user.id, "settings.update", "Setting", `export.${entity}`, {
    action: "csv_export",
  });

  return new Response(exporter.stream(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exporter.filename()}"`,
      "Cache-Control": "no-store",
      ...rateLimitHeaders(limit),
    },
  });
}
