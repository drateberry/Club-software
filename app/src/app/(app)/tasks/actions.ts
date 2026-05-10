"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";

const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
});

export async function createTask(formData: FormData) {
  const session = await requireSession();
  const parsed = taskSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    dueDate: formData.get("dueDate") ?? "",
  });
  await prisma.task.create({
    data: {
      title: parsed.title,
      description: parsed.description || null,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      createdById: session.user.id,
      assigneeId: session.user.id,
    },
  });
  revalidatePath("/tasks");
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  await requireSession();
  await prisma.task.update({ where: { id }, data: { status } });
  revalidatePath("/tasks");
}
