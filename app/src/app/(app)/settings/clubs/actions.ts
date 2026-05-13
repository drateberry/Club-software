"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Lowercase letters, numbers, hyphens; must not start with hyphen"),
  name: z.string().min(1).max(200),
});

export async function createClubAction(formData: FormData) {
  const session = await requireCapability("settings.write");
  const parsed = schema.parse({
    slug: String(formData.get("slug") ?? "").toLowerCase().trim(),
    name: String(formData.get("name") ?? "").trim(),
  });

  const existing = await prisma.club.findUnique({ where: { slug: parsed.slug } });
  if (existing) {
    redirect(`/settings/clubs?err=Slug%20already%20exists`);
  }

  const club = await prisma.club.create({
    data: { slug: parsed.slug, name: parsed.name },
  });

  await logAudit(session.user.id, "settings.update", "Setting", `club.${club.id}`, {
    action: "createClub",
    slug: parsed.slug,
    name: parsed.name,
  });

  revalidatePath("/settings/clubs");
  redirect(`/settings/clubs?ok=Club%20${encodeURIComponent(parsed.slug)}%20created`);
}
