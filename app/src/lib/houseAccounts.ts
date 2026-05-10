import { InvoiceKind, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export const HOUSE_ACCOUNT_CATEGORIES = [
  "Dining",
  "Pro Shop",
  "Guest Fees",
  "Locker",
  "Other",
] as const;

export type HouseAccountCategory = (typeof HOUSE_ACCOUNT_CATEGORIES)[number];

async function nextStatementInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.invoice.findFirst({
    where: { number: { startsWith: `STMT-${year}-` } },
    orderBy: { number: "desc" },
  });
  const seq = last
    ? Number.parseInt(last.number.split("-").at(-1) ?? "0", 10) + 1
    : 1;
  return `STMT-${year}-${String(seq).padStart(4, "0")}`;
}

/**
 * Aggregates all unbilled HouseCharges in [periodStart, periodEnd) per member,
 * creates one Invoice (kind=STATEMENT) per member with charges as line items,
 * and links charges back via HouseCharge.invoiceId.
 *
 * Idempotent at the period+member level via Statement (memberId, periodStart)
 * unique constraint.
 */
export async function generateStatements(
  periodStart: Date,
  periodEnd: Date,
  options: { dueDate?: Date } = {}
): Promise<{ created: number; skipped: number }> {
  const charges = await prisma.houseCharge.findMany({
    where: {
      invoiceId: null,
      occurredOn: { gte: periodStart, lt: periodEnd },
    },
    include: { member: true },
    orderBy: [{ memberId: "asc" }, { occurredOn: "asc" }],
  });

  const byMember = new Map<string, typeof charges>();
  for (const charge of charges) {
    const list = byMember.get(charge.memberId) ?? [];
    list.push(charge);
    byMember.set(charge.memberId, list);
  }

  let created = 0;
  let skipped = 0;
  const dueDate = options.dueDate ?? addDays(periodEnd, 30);

  for (const [memberId, memberCharges] of byMember) {
    const existing = await prisma.statement.findUnique({
      where: { memberId_periodStart: { memberId, periodStart } },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const total = memberCharges.reduce((sum, c) => sum + c.amountCents, 0);
    const number = await nextStatementInvoiceNumber();

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          number,
          memberId,
          kind: InvoiceKind.STATEMENT,
          status: InvoiceStatus.SENT,
          currency: process.env.CLUB_CURRENCY ?? "USD",
          totalCents: total,
          dueDate,
          lines: {
            create: memberCharges.map((c) => ({
              description: `${c.category}${c.memo ? ` — ${c.memo}` : ""} (${c.occurredOn.toISOString().slice(0, 10)})`,
              quantity: 1,
              unitCents: c.amountCents,
              totalCents: c.amountCents,
              kind: InvoiceKind.STATEMENT,
            })),
          },
        },
      });

      await tx.statement.create({
        data: { memberId, periodStart, periodEnd, invoiceId: invoice.id },
      });

      await tx.houseCharge.updateMany({
        where: { id: { in: memberCharges.map((c) => c.id) } },
        data: { invoiceId: invoice.id },
      });
    });

    created += 1;
  }

  return { created, skipped };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}
