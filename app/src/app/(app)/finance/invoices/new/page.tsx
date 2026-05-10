import Link from "next/link";
import { InvoiceKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { createInvoice } from "../actions";

export default async function NewInvoicePage() {
  await requireCapability("finance.write");

  const members = await prisma.member.findMany({
    where: { deletedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, memberNumber: true },
  });

  const lineCount = 3;

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/finance/invoices" className="text-sm text-gray-600 hover:underline">
        ← Invoices
      </Link>
      <h1 className="text-2xl font-semibold">New invoice</h1>

      <form action={createInvoice} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <input type="hidden" name="lineCount" value={lineCount} />

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">Member</span>
            <select
              name="memberId"
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">Select…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.lastName}, {m.firstName} {m.memberNumber ? `(#${m.memberNumber})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Kind</span>
            <select
              name="kind"
              required
              defaultValue={InvoiceKind.DUES}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            >
              {Object.values(InvoiceKind).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Due date</span>
          <input
            type="date"
            name="dueDate"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Line items</legend>
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 text-sm">
              <input
                type="text"
                name={`line-${i}-description`}
                placeholder={i === 0 ? "Annual Dues" : "Description"}
                className="col-span-7 rounded border border-gray-300 px-3 py-2"
                required={i === 0}
              />
              <input
                type="number"
                name={`line-${i}-quantity`}
                min={1}
                defaultValue={1}
                className="col-span-2 rounded border border-gray-300 px-3 py-2"
              />
              <input
                type="number"
                name={`line-${i}-unit`}
                step="0.01"
                min={0}
                placeholder={i === 0 ? "1500.00" : "0.00"}
                className="col-span-3 rounded border border-gray-300 px-3 py-2"
              />
            </div>
          ))}
        </fieldset>

        <label className="block text-sm">
          <span className="font-medium">Notes</span>
          <textarea
            name="notes"
            rows={2}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Link
            href="/finance/invoices"
            className="rounded border border-gray-300 px-4 py-2 text-sm"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Create draft
          </button>
        </div>
      </form>
    </div>
  );
}
