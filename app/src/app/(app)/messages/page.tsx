import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { formatDateTime } from "@/lib/format";
import { formatHuman } from "@/lib/twilio/normalize";
import { EmptyState } from "@/components/EmptyState";

export default async function MessagesPage() {
  await requireCapability("messaging.read");

  const conversations = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, memberNumber: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, direction: true, createdAt: true },
      },
    },
  });

  const unreadCount = conversations.filter((c) => c.unread).length;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Messages</h1>
        {unreadCount > 0 && (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs uppercase text-amber-900">
            {unreadCount} unread
          </span>
        )}
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Conversations start when you send a member their first SMS, or when a member texts the club's Twilio number."
        />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {conversations.map((c) => {
            const last = c.messages[0];
            const preview =
              last?.body?.replace(/\s+/g, " ").trim().slice(0, 100) ?? "";
            const who = c.member
              ? `${c.member.firstName} ${c.member.lastName}`
              : formatHuman(c.phone);
            return (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  className={`flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 ${
                    c.unread ? "bg-blue-50/40" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{who}</span>
                      {c.unread && (
                        <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          New
                        </span>
                      )}
                      {c.optedOut && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] uppercase text-red-900">
                          Opted out
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {last
                        ? `${last.direction === "OUTBOUND" ? "→" : "←"} ${preview || "(media)"}`
                        : "No messages yet"}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-xs text-gray-400">
                    {formatDateTime(c.lastMessageAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
