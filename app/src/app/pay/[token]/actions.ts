"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  applyInstallmentPlan,
  ensureInstallmentPaymentLink,
  type InstallmentPlan,
} from "@/lib/payments/installments";

const planSchema = z.object({
  plan: z.enum(["full", "quarterly_3", "monthly_8"]),
});

export async function selectPlan(invoiceId: string, formData: FormData) {
  const { plan } = planSchema.parse({ plan: formData.get("plan") });
  await applyInstallmentPlan(invoiceId, plan as InstallmentPlan);
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { paymentToken: true },
  });
  revalidatePath(`/pay/${invoice?.paymentToken}`);
  redirect(`/pay/${invoice?.paymentToken}`);
}

export async function payInstallment(installmentId: string) {
  const result = await ensureInstallmentPaymentLink(installmentId);
  redirect(result.url);
}
