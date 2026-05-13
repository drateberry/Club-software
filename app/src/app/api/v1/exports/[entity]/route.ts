import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authenticateBearer } from "@/lib/mcp/auth";
import { effectiveCapabilities, type Capability } from "@/lib/capabilities";
import { consume, rateLimitHeaders } from "@/lib/api/rateLimit";
import { logAudit } from "@/lib/audit";
import { getExporter } from "@/lib/csv/exporters";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** Resolve an auth context from bearer first, then Auth.js session cookie. */
async function resolveAuth(req: Request): Promise<
  | { ok: true; userId: string; role: "ADMIN" | "STAFF" | "MEMBER"; effective: Capability[]; scopes: Capability[] }
  | { ok: false; status: 401 }
> {
  const bearer = await authenticateBearer(req.headers.get("authorization"));
  if (bearer.ok) {
    return {
      ok: true,
      userId: bearer.ctx.user.id,
      role: bearer.ctx.user.role,
      effective: bearer.ctx.user.capabilities,
      scopes: bearer.ctx.scopes,
    };
  }
  const session = await auth();
  if (!session?.user?.id) return { ok: false, status: 401 };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, capabilities: true },
  });
  if (!user) return { ok: false, status: 401 };
  const effective = effectiveCapabilities(user.role, (user.capabilities ?? []) as Capability[]);
  return { ok: true, userId: session.user.id, role: user.role, effective, scopes: effective };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const resolved = await resolveAuth(req);
  if (!resolved.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { entity } = await params;
  const exporter = getExporter(entity);
  if (!exporter) {
    return NextResponse.json({ error: "unknown_entity" }, { status: 404 });
  }
  const hasRequiredScopes = exporter.scopes.every(
    (cap) => resolved.scopes.includes(cap) && resolved.effective.includes(cap)
  );
  if (!hasRequiredScopes) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (resolved.role === "MEMBER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const limit = consume(`u:${resolved.userId}`, "strict");
  if (!limit.allowed) {
    return new NextResponse(
      JSON.stringify({ error: "rate_limited" }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", ...rateLimitHeaders(limit) },
      }
    );
  }

  await logAudit(resolved.userId, "settings.update", "Setting", `export.${entity}`, {
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
