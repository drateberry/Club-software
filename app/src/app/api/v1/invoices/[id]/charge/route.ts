import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateBearer, hasScope } from "@/lib/mcp/auth";
import { chargeOnFile } from "@/lib/payments/chargeOnFile";
import { logAudit } from "@/lib/audit";

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

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });
  if (!invoice) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }
  if (invoice.status === "VOID") {
    return NextResponse.json({ error: "voided" }, { status: 409 });
  }

  const next = invoice.installments.find((i) => i.status !== "PAID");
  const amount = next ? next.amountCents + next.adminFeeCents : invoice.totalCents;

  try {
    const result = await chargeOnFile({
      memberId: invoice.memberId,
      amountCents: amount,
      description: `Invoice ${invoice.number}${next ? ` — installment ${next.sequence}` : ""}`,
      invoiceId: next ? undefined : invoice.id,
      installmentId: next?.id,
    });
    await logAudit(auth.ctx.user.id, "payment.chargeOnFile", "Invoice", invoice.id, {
      source: "api/v1",
      amountCents: amount,
      paymentIntentId: result.paymentIntentId,
    });
    return NextResponse.json({
      paymentIntentId: result.paymentIntentId,
      status: result.status,
      amountCents: amount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "charge_failed", error_description: (err as Error).message },
      { status: 402 }
    );
  }
}
