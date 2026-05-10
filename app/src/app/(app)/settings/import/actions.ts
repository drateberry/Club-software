"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";

const rowSchema = z.object({
  first_name: z.string().min(1, "first_name is required").max(100),
  last_name: z.string().min(1, "last_name is required").max(100),
  email: z
    .string()
    .max(200)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || z.string().email().safeParse(v).success,
      "invalid email"
    ),
  phone: z.string().max(50).optional().or(z.literal("")),
  member_number: z.string().max(50).optional().or(z.literal("")),
  membership_class: z.string().max(50).optional().or(z.literal("")),
  join_date: z
    .string()
    .max(20)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || !Number.isNaN(new Date(v).getTime()),
      "invalid date"
    ),
  street_1: z.string().max(200).optional().or(z.literal("")),
  street_2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(50).optional().or(z.literal("")),
  zip: z.string().max(20).optional().or(z.literal("")),
});

type ParsedRow = z.infer<typeof rowSchema>;

function rowsFromCsv(csv: string): { rows: Record<string, string>[]; parseErrors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  const parseErrors = parsed.errors.map(
    (e) => `Row ${e.row}: ${e.message}`
  );
  return { rows: parsed.data, parseErrors };
}

export async function importMembersCsv(formData: FormData) {
  await requireCapability("members.write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/settings/import?err=Pick%20a%20CSV%20file");
  }
  const csv = await (file as File).text();
  const { rows, parseErrors } = rowsFromCsv(csv);

  if (rows.length === 0) {
    redirect(`/settings/import?err=${encodeURIComponent("Empty CSV (no data rows)")}`);
  }

  const valid: ParsedRow[] = [];
  const rowErrors: string[] = [...parseErrors];
  rows.forEach((raw, i) => {
    const result = rowSchema.safeParse(raw);
    if (result.success) {
      valid.push(result.data);
    } else {
      const issues = result.error.issues
        .map((iss) => `${iss.path.join(".") || "(row)"}: ${iss.message}`)
        .join("; ");
      rowErrors.push(`Row ${i + 2}: ${issues}`);
    }
  });

  let created = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of valid) {
      const member = await tx.member.create({
        data: {
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email || null,
          phone: row.phone || null,
          memberNumber: row.member_number || null,
          membershipClass: row.membership_class || null,
          joinDate: row.join_date ? new Date(row.join_date) : null,
        },
      });
      if (row.street_1) {
        await tx.address.create({
          data: {
            memberId: member.id,
            street1: row.street_1,
            street2: row.street_2 || null,
            city: row.city || "",
            state: row.state || "",
            zip: row.zip || "",
            country: "US",
            isPrimary: true,
          },
        });
      }
      created += 1;
    }
  });

  revalidatePath("/members");
  const summary = `Imported ${created} of ${rows.length} row(s)${rowErrors.length ? `; ${rowErrors.length} skipped` : ""}`;
  // Stash errors for display on the import page
  if (rowErrors.length) {
    await prisma.setting.upsert({
      where: { key: "import.lastErrors" },
      create: { key: "import.lastErrors", valueJson: rowErrors.slice(0, 100) },
      update: { valueJson: rowErrors.slice(0, 100) },
    });
  } else {
    await prisma.setting.deleteMany({ where: { key: "import.lastErrors" } });
  }
  redirect(`/settings/import?ok=${encodeURIComponent(summary)}`);
}
