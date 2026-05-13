"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/guards";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Lowercase letters, numbers, hyphens"),
  name: z.string().min(1).max(200),
});

export async function createClub(formData: FormData) {
  const session = await requireOperator();
  const parsed = schema.parse({
    slug: String(formData.get("slug") ?? "").toLowerCase().trim(),
    name: String(formData.get("name") ?? "").trim(),
  });

  const existing = await prisma.club.findUnique({ where: { slug: parsed.slug } });
  if (existing) {
    redirect(`/operator/clubs?err=Slug%20${encodeURIComponent(parsed.slug)}%20already%20exists`);
  }

  const club = await prisma.club.create({
    data: { slug: parsed.slug, name: parsed.name },
  });
  await logAudit(session.user.id, "settings.update", "Setting", `operator.createClub.${club.id}`, {
    slug: parsed.slug,
    name: parsed.name,
  });

  revalidatePath("/operator/clubs");
  redirect(`/operator/clubs/${club.id}?ok=Created`);
}

export async function renameClub(clubId: string, formData: FormData) {
  const session = await requireOperator();
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 200) {
    redirect(`/operator/clubs/${clubId}?err=Invalid%20name`);
  }
  await prisma.club.update({ where: { id: clubId }, data: { name } });
  await logAudit(session.user.id, "settings.update", "Setting", `operator.renameClub.${clubId}`, {
    name,
  });
  revalidatePath(`/operator/clubs/${clubId}`);
  redirect(`/operator/clubs/${clubId}?ok=Renamed`);
}
