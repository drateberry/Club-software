import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageDirection } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { formatDateTime } from "@/lib/format";
import { formatHuman } from "@/lib/twilio/normalize";
import { SubmitButton } from "@/components/SubmitButton";
import { sendReply, markRead } from "../actions";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("messaging.read");
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, memberNumber: true },
      },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });
  if (!conversation) notFound();

  if (conversation.unread) {
    await markRead(conversation.id);
  }

  const send = sendReply.bind(null, conversation.id);
  const who = conversation.member
    ? `${conversation.member.firstName} ${conversation.member.lastName}`
    : formatHuman(conversation.phone);

  return (
    <div className="space-y-4">
      <Link href="/messages" className="text-sm text-gray-600 hover:underline">
        ← Messages
      </Link>
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{who}</h1>
          <div className="text-sm text-gray-500">
            {formatHuman(conversation.phone)}
            {conversation.member && (
              <>
                {" · "}
                <Link
                  href={`/members/${conversation.member.id}`}
                  className="text-gray-600 hover:underline"
                >
                  Member profile
                </Link>
              </>
            )}
          </div>
        </div>
        {conversation.optedOut && (
          <span className="rounded bg-red-100 px-2 py-1 text-xs uppercase text-red-900">
            Opted out
          </span>
        )}
      </header>

      <ol className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        {conversation.messages.length === 0 ? (
          <li className="text-sm text-gray-500">No messages yet.</li>
        ) : (
          conversation.messages.map((m) => {
            const outbound = m.direction === MessageDirection.OUTBOUND;
            return (
              <li
                key={m.id}
                className={`flex ${outbound ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    outbound
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                  {Array.isArray(m.mediaUrls) && m.mediaUrls.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs underline">
                      {(m.mediaUrls as string[]).map((url, i) => (
                        <li key={i}>
                          <a href={url} target="_blank" rel="noreferrer">
                            Media #{i + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className={`mt-1 text-[10px] ${outbound ? "text-blue-100" : "text-gray-500"}`}>
                    {formatDateTime(m.createdAt)} · {m.status}
                    {m.errorMessage && ` · ${m.errorMessage}`}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ol>

      {conversation.optedOut ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          This recipient has opted out of texts. They must reply START to opt back in.
        </div>
      ) : (
        <form
          action={send}
          className="space-y-2 rounded-lg border border-gray-200 bg-white p-3"
        >
          <textarea
            name="body"
            required
            rows={3}
            placeholder="Type a reply…"
            className="block w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Sending…">Send</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
