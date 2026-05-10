"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";

const schema = z.object({
  message: z.string().min(1).max(5000),
  page: z.string().max(500).optional(),
});

export async function submitFeedback(input: { message: string; page?: string }) {
  const session = await requireSession();
  const parsed = schema.parse(input);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { memberId: true },
  });

  await prisma.feedback.create({
    data: {
      message: parsed.message,
      page: parsed.page ?? null,
      memberId: user?.memberId ?? null,
    },
  });

  revalidatePath("/feedback");
}
