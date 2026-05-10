"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCapability, requireSession } from "@/lib/guards";
import { logAudit } from "@/lib/audit";
import { createSetupIntent } from "@/lib/payments/setupIntent";

export async function createSetupIntentForMember(memberId: string): Promise<{
  clientSecret: string;
  publishableKey: string;
}> {
  const session = await requireSession();
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, user: { select: { id: true } } },
  });
  if (!member) throw new Error("Member not found");

  const isOwnMember = session.user.id && member.user?.id === session.user.id;
  if (!isOwnMember) {
    await requireCapability("members.write");
  }

  const { clientSecret } = await createSetupIntent(memberId);
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error("STRIPE_PUBLISHABLE_KEY is not set");

  return { clientSecret, publishableKey };
}

export async function deletePaymentMethod(memberId: string, paymentMethodId: string) {
  const session = await requireCapability("members.write");
  const pm = await prisma.savedPaymentMethod.findUnique({
    where: { id: paymentMethodId },
  });
  if (!pm || pm.memberId !== memberId) {
    redirect(`/members/${memberId}/payment-methods?err=Not%20found`);
  }
  await prisma.savedPaymentMethod.delete({ where: { id: paymentMethodId } });
  await logAudit(session.user.id, "payment.method.remove", "PaymentMethod", paymentMethodId, {
    memberId,
  });
  revalidatePath(`/members/${memberId}/payment-methods`);
  redirect(`/members/${memberId}/payment-methods?ok=Removed`);
}

export async function setDefaultPaymentMethod(memberId: string, paymentMethodId: string) {
  await requireCapability("members.write");
  await prisma.$transaction([
    prisma.savedPaymentMethod.updateMany({
      where: { memberId },
      data: { isDefault: false },
    }),
    prisma.savedPaymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true },
    }),
  ]);
  revalidatePath(`/members/${memberId}/payment-methods`);
  redirect(`/members/${memberId}/payment-methods?ok=Default%20updated`);
}
