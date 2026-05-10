import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { HOUSE_ACCOUNT_CATEGORIES } from "@/lib/houseAccounts";
import { addCharge } from "../actions";

export default async function AddChargePage() {
  await requireCapability("houseAccounts.write");

  const members = await prisma.member.findMany({
    where: { deletedAt: null, membershipStatus: "ACTIVE" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, memberNumber: true },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-xl space-y-4">
      <Link
        href="/house-accounts"
        className="text-sm text-gray-600 hover:underline"
      >
        ← House Accounts
      </Link>
      <h1 className="text-2xl font-semibold">Add charge</h1>
      <p className="text-sm text-gray-500">
        Posts a single charge to a member&apos;s house account. Charges roll up
        into next month&apos;s statement.
      </p>

      <form
        action={addCharge}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <label className="block text-sm">
          <span className="font-medium">Member</span>
          <select
            name="memberId"
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          >
            <option value="">Select a member…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.lastName}, {m.firstName}
                {m.memberNumber ? ` (#${m.memberNumber})` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">Category</span>
            <select
              name="category"
              required
              defaultValue="Dining"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            >
              {HOUSE_ACCOUNT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Amount</span>
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Date</span>
          <input
            type="date"
            name="occurredOn"
            required
            defaultValue={today}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Memo (optional)</span>
          <input
            type="text"
            name="memo"
            placeholder="Sat dinner / range balls / lesson with Pat"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Link
            href="/house-accounts"
            className="rounded border border-gray-300 px-4 py-2 text-sm"
          >
            Cancel
          </Link>
          <SubmitButton pendingLabel="Adding…">Add charge</SubmitButton>
        </div>
      </form>
    </div>
  );
}
