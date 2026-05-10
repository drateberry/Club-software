"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";

const memberSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  memberNumber: z.string().max(50).optional().or(z.literal("")),
  membershipClass: z.string().max(50).optional().or(z.literal("")),
});

export async function createMember(formData: FormData) {
  await requireCapability("members.write");
  const parsed = memberSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    memberNumber: formData.get("memberNumber") ?? "",
    membershipClass: formData.get("membershipClass") ?? "",
  });

  const member = await prisma.member.create({
    data: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email || null,
      phone: parsed.phone || null,
      memberNumber: parsed.memberNumber || null,
      membershipClass: parsed.membershipClass || null,
    },
  });

  revalidatePath("/members");
  redirect(`/members/${member.id}`);
}

export async function updateMember(id: string, formData: FormData) {
  await requireCapability("members.write");
  const parsed = memberSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    memberNumber: formData.get("memberNumber") ?? "",
    membershipClass: formData.get("membershipClass") ?? "",
  });

  await prisma.member.update({
    where: { id },
    data: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email || null,
      phone: parsed.phone || null,
      memberNumber: parsed.memberNumber || null,
      membershipClass: parsed.membershipClass || null,
    },
  });

  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
}

export async function deleteMember(id: string) {
  await requireCapability("members.write");
  await prisma.member.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/members");
  redirect("/members");
}
