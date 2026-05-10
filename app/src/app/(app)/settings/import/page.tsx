import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { importMembersCsv } from "./actions";

const TEMPLATE = `first_name,last_name,email,phone,member_number,membership_class,join_date,street_1,street_2,city,state,zip
James,Smith,james@example.com,+1-555-0100,1001,Full,2018-03-15,100 Oak Lane,,Greenwich,CT,06830
Mary,Johnson,mary@example.com,+1-555-0101,1002,Social,2020-09-01,200 Maple St,Apt 4B,New York,NY,10001`;

export default async function ImportPage() {
  await requireCapability("members.write");

  const errorsSetting = await prisma.setting.findUnique({
    where: { key: "import.lastErrors" },
  });
  const lastErrors = (errorsSetting?.valueJson as string[] | null) ?? [];

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/settings" className="text-sm text-gray-600 hover:underline">
        ← Settings
      </Link>
      <h1 className="text-2xl font-semibold">Import members</h1>
      <p className="text-sm text-gray-600">
        Upload a CSV with one row per member. Headers are case-insensitive and
        spaces become underscores. The file is parsed, validated row-by-row,
        then committed in a single transaction. Invalid rows are skipped and
        reported below.
      </p>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">CSV template</h2>
        <pre className="overflow-x-auto rounded bg-gray-50 px-3 py-2 text-xs">
{TEMPLATE}
        </pre>
        <p className="mt-2 text-xs text-gray-500">
          <strong>Required:</strong> first_name, last_name. Everything else is
          optional. <code>street_1</code> triggers address creation; partial
          addresses are accepted.
        </p>
      </section>

      <form
        action={importMembersCsv}
        className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <label className="block text-sm">
          <span className="font-medium">CSV file</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="mt-1 block w-full text-sm"
          />
        </label>
        <div className="flex justify-end">
          <SubmitButton pendingLabel="Importing…">Upload &amp; import</SubmitButton>
        </div>
      </form>

      {lastErrors.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-red-900">
            Last run skipped {lastErrors.length} row{lastErrors.length === 1 ? "" : "s"}
          </h2>
          <ul className="max-h-64 overflow-y-auto space-y-1 text-xs text-red-900">
            {lastErrors.map((err, i) => (
              <li key={i} className="font-mono">{err}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
