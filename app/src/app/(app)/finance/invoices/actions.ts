"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { InvoiceKind, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";

const lineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).max(9999),
  unitCents: z.number().int().min(0).max(100_000_000),
});

const invoiceSchema = z.object({
  memberId: z.string().min(1),
  kind: z.nativeEnum(InvoiceKind),
  dueDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  lines: z.array(lineSchema).min(1),
});

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.invoice.findFirst({
    where: { number: { startsWith: `INV-${year}-` } },
    orderBy: { number: "desc" },
  });
  const seq = last ? Number.parseInt(last.number.split("-").at(-1) ?? "0", 10) + 1 : 1;
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

export async function createInvoice(formData: FormData) {
  await requireCapability("finance.write");
  const lineCount = Number.parseInt((formData.get("lineCount") as string) ?? "1", 10);
  const lines = Array.from({ length: lineCount }, (_, i) => ({
    description: String(formData.get(`line-${i}-description`) ?? ""),
    quantity: Number.parseInt(String(formData.get(`line-${i}-quantity`) ?? "1"), 10),
    unitCents: Math.round(
      Number.parseFloat(String(formData.get(`line-${i}-unit`) ?? "0")) * 100
    ),
  }));

  const parsed = invoiceSchema.parse({
    memberId: formData.get("memberId"),
    kind: formData.get("kind"),
    dueDate: formData.get("dueDate") ?? "",
    notes: formData.get("notes") ?? "",
    lines,
  });

  const totalCents = parsed.lines.reduce(
    (sum, l) => sum + l.quantity * l.unitCents,
    0
  );
  const number = await nextInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      number,
      memberId: parsed.memberId,
      kind: parsed.kind,
      status: InvoiceStatus.DRAFT,
      currency: process.env.CLUB_CURRENCY ?? "USD",
      totalCents,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      notes: parsed.notes || null,
      lines: {
        create: parsed.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitCents: l.unitCents,
          totalCents: l.quantity * l.unitCents,
          kind: parsed.kind,
        })),
      },
    },
  });

  revalidatePath("/finance/invoices");
  redirect(`/finance/invoices/${invoice.id}`);
}

export async function sendInvoice(id: string) {
  await requireCapability("finance.write");
  await prisma.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.SENT },
  });
  revalidatePath("/finance/invoices");
  revalidatePath(`/finance/invoices/${id}`);
}

export async function voidInvoice(id: string) {
  await requireCapability("finance.write");
  await prisma.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.VOID },
  });
  revalidatePath("/finance/invoices");
  revalidatePath(`/finance/invoices/${id}`);
}
