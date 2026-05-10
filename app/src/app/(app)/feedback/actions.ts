"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";

const feedbackSchema = z.object({
  message: z.string().min(1).max(5000),
  page: z.string().max(200).optional().or(z.literal("")),
});

export async function createFeedback(formData: FormData) {
  const session = await requireSession();
  const parsed = feedbackSchema.parse({
    message: formData.get("message"),
    page: formData.get("page") ?? "",
  });
  const memberId = session.user.id ? (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { memberId: true },
  }))?.memberId : null;

  await prisma.feedback.create({
    data: {
      message: parsed.message,
      page: parsed.page || null,
      memberId: memberId ?? null,
    },
  });
  revalidatePath("/feedback");
}
