import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { DEFAULT_TRIGGERS, type TriggerKey, type TriggerMap } from "@/lib/twilio/triggers";
import { saveTwilioSettings, saveTriggers } from "./actions";
import { SettingsTabs } from "../tabs";

const TRIGGER_LABELS: Record<TriggerKey, string> = {
  "invoice.sent": "Invoice sent",
  "payment.received": "Payment received",
  "rsvp.confirmed": "RSVP confirmed",
  "statement.generated": "Statement generated",
  "waitlist.promoted": "Waitlist promoted",
};

export default async function MessagingSettingsPage() {
  await requireCapability("settings.write");

  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "twilio.accountSid",
          "twilio.authToken",
          "twilio.fromNumber",
          "messaging.helpText",
          "messaging.triggers",
        ],
      },
    },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.valueJson])) as Record<
    string,
    unknown
  >;
  const storedTriggers = (map["messaging.triggers"] as Partial<TriggerMap> | null) ?? {};
  const triggers: TriggerMap = { ...DEFAULT_TRIGGERS, ...storedTriggers };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsTabs active="messaging" />

      <form
        action={saveTwilioSettings}
        className="max-w-xl space-y-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-gray-700">Twilio</h2>
        <p className="text-xs text-gray-500">
          Per-club Twilio account. The auth token is stored encrypted at rest.
          Configure your Twilio number&apos;s inbound and status callbacks to{" "}
          <code className="rounded bg-gray-100 px-1">{`{base}/api/webhooks/twilio/inbound`}</code> and{" "}
          <code className="rounded bg-gray-100 px-1">{`{base}/api/webhooks/twilio/status`}</code>.
        </p>

        <label className="block text-sm">
          <span className="font-medium">Account SID</span>
          <input
            type="text"
            name="accountSid"
            required
            defaultValue={(map["twilio.accountSid"] as string) ?? ""}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Auth token</span>
          <input
            type="password"
            name="authToken"
            required
            defaultValue={(map["twilio.authToken"] as string) ?? ""}
            placeholder="••••••••"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">From number (E.164)</span>
          <input
            type="text"
            name="fromNumber"
            required
            defaultValue={(map["twilio.fromNumber"] as string) ?? ""}
            placeholder="+15551234567"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">HELP reply</span>
          <textarea
            name="helpText"
            rows={2}
            defaultValue={(map["messaging.helpText"] as string) ?? ""}
            placeholder="Pinehurst Country Club: For help, call (555) 123-4567. Reply STOP to opt out."
            className="mt-1 block w-full resize-none rounded border border-gray-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-gray-500">
            Sent automatically when a member texts HELP. Required for TCPA compliance.
          </span>
        </label>

        <div className="flex justify-end">
          <SubmitButton>Save</SubmitButton>
        </div>
      </form>

      <form
        action={saveTriggers}
        className="max-w-2xl space-y-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-gray-700">Triggered messages</h2>
        <p className="text-xs text-gray-500">
          Auto-send an SMS to the affected member when these events fire.
          Supports placeholders: <code>{"{first_name}"}</code>,{" "}
          <code>{"{member_name}"}</code>, <code>{"{club_name}"}</code>,{" "}
          <code>{"{invoice_number}"}</code>, <code>{"{amount}"}</code>,{" "}
          <code>{"{payment_url}"}</code>, <code>{"{event_title}"}</code>,{" "}
          <code>{"{event_date}"}</code>.
        </p>

        {(Object.keys(TRIGGER_LABELS) as TriggerKey[]).map((key) => {
          const cfg = triggers[key];
          return (
            <div key={key} className="space-y-2 rounded border border-gray-200 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`enabled-${key}`}
                  defaultChecked={cfg.enabled}
                />
                <span className="font-medium">{TRIGGER_LABELS[key]}</span>
              </label>
              <textarea
                name={`template-${key}`}
                rows={2}
                defaultValue={cfg.template}
                className="block w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          );
        })}

        <div className="flex justify-end">
          <SubmitButton>Save triggers</SubmitButton>
        </div>
      </form>
    </div>
  );
}
