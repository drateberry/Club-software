"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import {
  HOUSE_ACCOUNT_CATEGORIES,
  generateStatements,
  startOfMonth,
  startOfNextMonth,
} from "@/lib/houseAccounts";

const chargeSchema = z.object({
  memberId: z.string().min(1),
  category: z.enum(HOUSE_ACCOUNT_CATEGORIES),
  amount: z.string().min(1),
  occurredOn: z.string().min(1),
  memo: z.string().max(500).optional().or(z.literal("")),
});

export async function addCharge(formData: FormData) {
  const session = await requireCapability("houseAccounts.write");
  const parsed = chargeSchema.parse({
    memberId: formData.get("memberId"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    occurredOn: formData.get("occurredOn"),
    memo: formData.get("memo") ?? "",
  });

  const amountCents = Math.round(Number.parseFloat(parsed.amount) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    redirect("/house-accounts/charge?err=Amount%20must%20be%20greater%20than%20zero");
  }

  await prisma.houseCharge.create({
    data: {
      memberId: parsed.memberId,
      category: parsed.category,
      amountCents,
      occurredOn: new Date(parsed.occurredOn),
      memo: parsed.memo || null,
      postedById: session.user.id,
    },
  });

  revalidatePath("/house-accounts");
  revalidatePath(`/house-accounts/${parsed.memberId}`);
  redirect(`/house-accounts/charge?ok=Charge%20added`);
}

export async function deleteCharge(chargeId: string, memberId: string) {
  await requireCapability("houseAccounts.write");
  await prisma.houseCharge.delete({ where: { id: chargeId } });
  revalidatePath("/house-accounts");
  revalidatePath(`/house-accounts/${memberId}`);
}

export async function runMonthlyStatements() {
  await requireCapability("houseAccounts.write");
  const now = new Date();
  const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const end = startOfNextMonth(start);
  const result = await generateStatements(start, end);
  revalidatePath("/house-accounts");
  redirect(
    `/house-accounts?ok=Generated%20${result.created}%20statement(s)${
      result.skipped ? `%20(${result.skipped}%20already%20existed)` : ""
    }`
  );
}
