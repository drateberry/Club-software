"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ComplianceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";

const certificateSchema = z.object({
  memberId: z.string().min(1),
  type: z.string().min(1).max(200),
  status: z.nativeEnum(ComplianceStatus),
  certifiedOn: z.string().optional().or(z.literal("")),
  expiresOn: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function createCertificate(formData: FormData) {
  await requireCapability("compliance.write");
  const parsed = certificateSchema.parse({
    memberId: formData.get("memberId"),
    type: formData.get("type"),
    status: formData.get("status"),
    certifiedOn: formData.get("certifiedOn") ?? "",
    expiresOn: formData.get("expiresOn") ?? "",
    notes: formData.get("notes") ?? "",
  });

  await prisma.complianceCertificate.create({
    data: {
      memberId: parsed.memberId,
      type: parsed.type,
      status: parsed.status,
      certifiedOn: parsed.certifiedOn ? new Date(parsed.certifiedOn) : null,
      expiresOn: parsed.expiresOn ? new Date(parsed.expiresOn) : null,
      notes: parsed.notes || null,
    },
  });

  revalidatePath("/compliance");
  redirect("/compliance?ok=Certificate%20added");
}

export async function deleteCertificate(id: string) {
  await requireCapability("compliance.write");
  await prisma.complianceCertificate.delete({ where: { id } });
  revalidatePath("/compliance");
}
