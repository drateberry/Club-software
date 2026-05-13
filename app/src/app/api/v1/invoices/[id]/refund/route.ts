import { NextResponse } from "next/server";
import { authenticateBearer, hasScope } from "@/lib/mcp/auth";
import { refundInvoice } from "@/lib/payments/refunds";
import { logAudit } from "@/lib/audit";
import { consume, rateLimitHeaders } from "@/lib/api/rateLimit";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasScope(auth.ctx, ["payments.chargeOnFile"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (auth.ctx.user.role === "MEMBER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const limit = consume(`u:${auth.ctx.user.id}`, "strict");
  if (!limit.allowed) {
    return new NextResponse(
      JSON.stringify({ error: "rate_limited" }),
      { status: 429, headers: { "Content-Type": "application/json", ...rateLimitHeaders(limit) } }
    );
  }

  const { id } = await params;
  let body: { reason?: string } = {};
  try {
    body = (await req.json()) as { reason?: string };
  } catch {
    /* allow empty body */
  }

  try {
    const result = await refundInvoice({
      invoiceId: id,
      reason: body.reason,
      actorUserId: auth.ctx.user.id,
    });
    await logAudit(auth.ctx.user.id, "invoice.void", "Invoice", id, {
      action: "refund",
      source: "api/v1",
      ...result,
    });
    return NextResponse.json(result, { headers: rateLimitHeaders(limit) });
  } catch (err) {
    return NextResponse.json(
      { error: "refund_failed", error_description: (err as Error).message },
      { status: 400, headers: rateLimitHeaders(limit) }
    );
  }
}
