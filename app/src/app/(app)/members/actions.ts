"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { logAudit } from "@/lib/audit";

const memberSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  memberNumber: z.string().max(50).optional().or(z.literal("")),
  membershipClass: z.string().max(50).optional().or(z.literal("")),
});

export async function createMember(formData: FormData) {
  const session = await requireCapability("members.write");
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
  await logAudit(session.user.id, "member.create", "Member", member.id, parsed);

  revalidatePath("/members");
  redirect(`/members/${member.id}?ok=Member%20created`);
}

export async function updateMember(id: string, formData: FormData) {
  const session = await requireCapability("members.write");
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
  await logAudit(session.user.id, "member.update", "Member", id, parsed);

  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  redirect(`/members/${id}?ok=Saved`);
}

export async function deleteMember(id: string) {
  const session = await requireCapability("members.write");
  await prisma.member.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await logAudit(session.user.id, "member.delete", "Member", id);
  revalidatePath("/members");
  redirect("/members?ok=Member%20deleted");
}

const addressSchema = z.object({
  street1: z.string().min(1).max(200),
  street2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  zip: z.string().min(1).max(20),
  country: z.string().max(50).optional().or(z.literal("")),
});

export async function addAddress(memberId: string, formData: FormData) {
  await requireCapability("members.write");
  const parsed = addressSchema.parse({
    street1: formData.get("street1"),
    street2: formData.get("street2") ?? "",
    city: formData.get("city"),
    state: formData.get("state"),
    zip: formData.get("zip"),
    country: formData.get("country") ?? "US",
  });
  const existing = await prisma.address.count({ where: { memberId } });
  await prisma.address.create({
    data: {
      memberId,
      street1: parsed.street1,
      street2: parsed.street2 || null,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      country: parsed.country || "US",
      isPrimary: existing === 0,
    },
  });
  revalidatePath(`/members/${memberId}`);
}

export async function deleteAddress(memberId: string, addressId: string) {
  await requireCapability("members.write");
  await prisma.address.delete({ where: { id: addressId } });
  revalidatePath(`/members/${memberId}`);
}

const fieldSchema = z.union([
  z.object({ field: z.literal("email"), value: z.string().email().or(z.literal("")) }),
  z.object({ field: z.literal("phone"), value: z.string().max(50) }),
  z.object({ field: z.literal("memberNumber"), value: z.string().max(50) }),
  z.object({ field: z.literal("membershipClass"), value: z.string().max(50) }),
  z.object({ field: z.literal("membershipStatus"), value: z.nativeEnum(MembershipStatus) }),
]);

export async function updateMemberField(
  id: string,
  field: "email" | "phone" | "memberNumber" | "membershipClass" | "membershipStatus",
  value: string
) {
  await requireCapability("members.write");
  const parsed = fieldSchema.parse({ field, value });
  const data: Record<string, string | null> = {};
  if (parsed.field === "email") data.email = parsed.value || null;
  else if (parsed.field === "phone") data.phone = parsed.value || null;
  else if (parsed.field === "memberNumber") data.memberNumber = parsed.value || null;
  else if (parsed.field === "membershipClass") data.membershipClass = parsed.value || null;
  else data.membershipStatus = parsed.value;

  await prisma.member.update({ where: { id }, data });
  revalidatePath("/members");
}

const bulkSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(500),
  action: z.enum(["activate", "suspend", "delete"]),
});

export async function bulkUpdateMembers(input: {
  ids: string[];
  action: "activate" | "suspend" | "delete";
}) {
  const session = await requireCapability("members.write");
  const parsed = bulkSchema.parse(input);

  if (parsed.action === "delete") {
    await prisma.member.updateMany({
      where: { id: { in: parsed.ids } },
      data: { deletedAt: new Date() },
    });
  } else {
    await prisma.member.updateMany({
      where: { id: { in: parsed.ids } },
      data: {
        membershipStatus:
          parsed.action === "activate"
            ? MembershipStatus.ACTIVE
            : MembershipStatus.SUSPENDED,
      },
    });
  }
  await logAudit(
    session.user.id,
    "member.bulkUpdate",
    "Member",
    parsed.ids.join(","),
    { action: parsed.action, count: parsed.ids.length }
  );
  revalidatePath("/members");
}
