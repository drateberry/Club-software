import { getTranslations } from "next-intl/server";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { formatDate } from "@/lib/format";
import { createTask, updateTaskStatus } from "./actions";

const STATUS_FLOW: Record<TaskStatus, TaskStatus> = {
  OPEN: TaskStatus.IN_PROGRESS,
  IN_PROGRESS: TaskStatus.DONE,
  DONE: TaskStatus.ARCHIVED,
  ARCHIVED: TaskStatus.OPEN,
};

export default async function TasksPage() {
  const session = await requireSession();
  const t = await getTranslations();

  const tasks = await prisma.task.findMany({
    where: { assigneeId: session.user.id, status: { not: TaskStatus.ARCHIVED } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    include: { linkedMember: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("tasks.title")}</h1>
      </div>

      <form action={createTask} className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex gap-2">
          <input
            type="text"
            name="title"
            placeholder={t("tasks.newTask")}
            required
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            name="dueDate"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
            {t("common.save")}
          </button>
        </div>
      </form>

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500">{t("tasks.noTasks")}</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {tasks.map((task) => {
            const advance = updateTaskStatus.bind(null, task.id, STATUS_FLOW[task.status]);
            return (
              <li key={task.id} className="flex items-center justify-between p-4 text-sm">
                <div className="flex items-center gap-3">
                  <form action={advance}>
                    <button
                      type="submit"
                      className="rounded border border-gray-300 px-2 py-1 text-xs uppercase text-gray-600"
                    >
                      {task.status}
                    </button>
                  </form>
                  <span>{task.title}</span>
                </div>
                <div className="text-gray-500">{formatDate(task.dueDate)}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
