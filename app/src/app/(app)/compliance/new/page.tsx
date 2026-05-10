import Link from "next/link";
import { ComplianceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { createCertificate } from "../actions";

export default async function NewCertificatePage() {
  await requireCapability("compliance.write");

  const members = await prisma.member.findMany({
    where: { deletedAt: null, membershipStatus: "ACTIVE" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, memberNumber: true },
  });

  return (
    <div className="max-w-xl space-y-4">
      <Link href="/compliance" className="text-sm text-gray-600 hover:underline">
        ← Compliance
      </Link>
      <h1 className="text-2xl font-semibold">Add certificate</h1>

      <form
        action={createCertificate}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-4"
      >
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
                {m.lastName}, {m.firstName}
                {m.memberNumber ? ` (#${m.memberNumber})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Type</span>
          <input
            type="text"
            name="type"
            required
            placeholder="e.g. Background Check (Youth Program)"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Status</span>
          <select
            name="status"
            required
            defaultValue={ComplianceStatus.CERTIFIED}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          >
            {Object.values(ComplianceStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">Certified on</span>
            <input
              type="date"
              name="certifiedOn"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Expires on</span>
            <input
              type="date"
              name="expiresOn"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium">Notes</span>
          <textarea
            name="notes"
            rows={2}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Link href="/compliance" className="rounded border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </Link>
          <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        </div>
      </form>
    </div>
  );
}
