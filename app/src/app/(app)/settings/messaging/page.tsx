import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { saveTwilioSettings } from "./actions";
import { SettingsTabs } from "../tabs";

export default async function MessagingSettingsPage() {
  await requireCapability("settings.write");

  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: ["twilio.accountSid", "twilio.authToken", "twilio.fromNumber", "messaging.helpText"],
      },
    },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.valueJson])) as Record<
    string,
    string | null
  >;

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
            defaultValue={map["twilio.accountSid"] ?? ""}
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
            defaultValue={map["twilio.authToken"] ?? ""}
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
            defaultValue={map["twilio.fromNumber"] ?? ""}
            placeholder="+15551234567"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">HELP reply</span>
          <textarea
            name="helpText"
            rows={2}
            defaultValue={map["messaging.helpText"] ?? ""}
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
    </div>
  );
}
