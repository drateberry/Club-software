"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireSession, requireCapability } from "@/lib/guards";

export async function logCheckin(passToken: string, formData: FormData) {
  await requireSession();
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);

  const user = await prisma.user.findUnique({
    where: { passToken },
    select: { memberId: true },
  });
  if (!user?.memberId) {
    redirect(`/checkin/${passToken}?err=No%20member%20linked%20to%20this%20pass`);
  }

  await prisma.checkinLog.create({
    data: {
      memberId: user.memberId,
      notes: note || null,
    },
  });
  revalidatePath("/checkin");
  redirect(`/checkin/${passToken}?ok=Checked%20in`);
}

export async function manualCheckin(formData: FormData) {
  await requireCapability("checkin.scan");
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) redirect("/checkin?err=Pick%20a%20member");
  await prisma.checkinLog.create({ data: { memberId } });
  revalidatePath("/checkin");
  redirect("/checkin?ok=Checked%20in");
}

export async function generateMemberPass(memberId: string) {
  await requireCapability("members.write");
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { user: true },
  });
  if (!member) throw new Error("Member not found");

  const passToken = randomBytes(24).toString("hex");

  if (member.user) {
    await prisma.user.update({
      where: { id: member.user.id },
      data: { passToken },
    });
  } else {
    if (!member.email) {
      redirect(`/members/${memberId}?err=Member%20needs%20email%20before%20issuing%20pass`);
    }
    await prisma.user.create({
      data: {
        email: member.email!,
        name: `${member.firstName} ${member.lastName}`,
        memberId: member.id,
        role: "MEMBER",
        passToken,
      },
    });
  }

  revalidatePath(`/members/${memberId}`);
  redirect(`/members/${memberId}?ok=Pass%20issued`);
}
