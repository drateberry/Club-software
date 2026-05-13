import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import type { TriggerKey } from "@/lib/twilio/triggers";
import type { NotificationPrefs, Channel } from "@/lib/notifications/prefs";
import { saveNotificationPrefs } from "../actions";

const TRIGGERS: Array<{ key: TriggerKey; label: string; description: string }> = [
  {
    key: "invoice.sent",
    label: "Invoices sent",
    description: "Notify me when a new invoice is sent to me.",
  },
  {
    key: "payment.received",
    label: "Payments received",
    description: "Notify me when my payment is recorded.",
  },
  {
    key: "rsvp.confirmed",
    label: "Event RSVPs",
    description: "Notify me when I RSVP yes to an event.",
  },
  {
    key: "statement.generated",
    label: "Monthly statements",
    description: "Notify me when my monthly statement is ready.",
  },
  {
    key: "waitlist.promoted",
    label: "Waitlist promotion",
    description: "Notify me when an event spot opens for me.",
  },
];

const CHANNELS: Array<{ key: Channel; label: string }> = [
  { key: "sms", label: "Text message" },
  { key: "email", label: "Email" },
];

export default async function NotificationPrefsPage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notificationPrefs: true },
  });
  const prefs = (user?.notificationPrefs as NotificationPrefs | null) ?? {};

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/profile" className="text-sm text-gray-600 hover:underline">
        ← Profile
      </Link>
      <h1 className="text-2xl font-semibold">Notification preferences</h1>
      <p className="text-sm text-gray-500">
        Default is on. Uncheck anything you don&apos;t want to hear about.
        Critical messages (e.g. STOP/HELP for SMS compliance) always reply.
      </p>

      <form
        action={saveNotificationPrefs}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <th className="pb-2">Notification</th>
              {CHANNELS.map((c) => (
                <th key={c.key} className="pb-2 text-center">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {TRIGGERS.map((t) => (
              <tr key={t.key}>
                <td className="py-2.5">
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-gray-500">{t.description}</div>
                </td>
                {CHANNELS.map((c) => {
                  const checked = (prefs[c.key]?.[t.key] ?? true) !== false;
                  return (
                    <td key={c.key} className="py-2.5 text-center">
                      <input
                        type="checkbox"
                        name={`${c.key}.${t.key}`}
                        defaultChecked={checked}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end">
          <SubmitButton pendingLabel="Saving…">Save preferences</SubmitButton>
        </div>
      </form>
    </div>
  );
}
