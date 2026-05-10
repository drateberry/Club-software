"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";

const groupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  type: z.string().max(50).optional().or(z.literal("")),
});

export async function createGroup(formData: FormData) {
  await requireCapability("groups.write");
  const parsed = groupSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    type: formData.get("type") ?? "",
  });
  const group = await prisma.group.create({
    data: {
      name: parsed.name,
      description: parsed.description || null,
      type: parsed.type || null,
    },
  });
  revalidatePath("/groups");
  redirect(`/groups/${group.id}?ok=Group%20created`);
}

export async function updateGroup(id: string, formData: FormData) {
  await requireCapability("groups.write");
  const parsed = groupSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    type: formData.get("type") ?? "",
  });
  await prisma.group.update({
    where: { id },
    data: {
      name: parsed.name,
      description: parsed.description || null,
      type: parsed.type || null,
    },
  });
  revalidatePath(`/groups/${id}`);
  redirect(`/groups/${id}?ok=Saved`);
}
