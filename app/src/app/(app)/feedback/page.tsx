import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { formatDateTime } from "@/lib/format";
import { createFeedback } from "./actions";

export default async function FeedbackPage() {
  await requireSession();
  const t = await getTranslations();

  const feedback = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { member: { select: { firstName: true, lastName: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("feedback.title")}</h1>

      <form action={createFeedback} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <textarea
          name="message"
          rows={3}
          placeholder={t("feedback.newFeedback")}
          required
          className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
            {t("common.save")}
          </button>
        </div>
      </form>

      {feedback.length === 0 ? (
        <p className="text-sm text-gray-500">{t("feedback.noFeedback")}</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {feedback.map((f) => (
            <li key={f.id} className="space-y-1 p-4 text-sm">
              <p className="whitespace-pre-wrap">{f.message}</p>
              <div className="text-xs text-gray-500">
                {f.member ? `${f.member.firstName} ${f.member.lastName}` : "Anonymous"} ·{" "}
                {formatDateTime(f.createdAt)} · {f.status}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
