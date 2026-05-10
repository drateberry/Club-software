import { requireCapability } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { SETTING_KEYS, getSetting } from "@/lib/settings";
import { saveEmailSettings } from "../actions";
import { SettingsTabs } from "../tabs";

export default async function EmailSettingsPage() {
  await requireCapability("settings.write");
  const from = await getSetting(SETTING_KEYS.emailFrom, process.env.EMAIL_FROM ?? "");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsTabs active="email" />

      <form
        action={saveEmailSettings}
        className="max-w-xl space-y-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-gray-700">Email</h2>
        <p className="text-xs text-gray-500">
          The transport endpoint (Mailpit, SES SMTP, Postmark, etc.) is configured via
          the <code className="rounded bg-gray-100 px-1">EMAIL_SERVER</code> environment
          variable. This page sets the From address that recipients see.
        </p>

        <label className="block text-sm">
          <span className="font-medium">From address</span>
          <input
            type="text"
            name="from"
            required
            defaultValue={from as string}
            placeholder='Pinehurst Country Club <noreply@pinehurst.club>'
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <div className="flex justify-end">
          <SubmitButton>Save</SubmitButton>
        </div>
      </form>

      <section className="max-w-xl rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <h2 className="text-sm font-semibold text-gray-700">Provider notes</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Local dev: <code>EMAIL_SERVER=smtp://localhost:1025</code> (Mailpit).
          </li>
          <li>
            Amazon SES: <code>EMAIL_SERVER=smtp+ssl://USER:PASS@email-smtp.us-east-1.amazonaws.com:465</code>
            . Use SES SMTP credentials, not IAM access keys.
          </li>
          <li>
            Postmark / Mailgun: any provider that exposes SMTP works without code changes.
          </li>
        </ul>
      </section>
    </div>
  );
}
