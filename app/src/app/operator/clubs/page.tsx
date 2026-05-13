import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/guards";
import { formatDateTime } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { createClub } from "./actions";

export default async function OperatorClubsPage() {
  await requireOperator();

  // Operator context → Prisma extension is a no-op → these aggregates
  // count across every tenant.
  const clubs = await prisma.club.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          users: true,
          members: true,
          invoices: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Clubs</h1>
        <span className="text-xs text-gray-500">{clubs.length} tenant(s)</span>
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Club</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2 text-right">Users</th>
              <th className="px-4 py-2 text-right">Members</th>
              <th className="px-4 py-2 text-right">Invoices</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clubs.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/operator/clubs/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-gray-600">
                  {c.slug}
                </td>
                <td className="px-4 py-2 text-right text-gray-700">
                  {c._count.users}
                </td>
                <td className="px-4 py-2 text-right text-gray-700">
                  {c._count.members}
                </td>
                <td className="px-4 py-2 text-right text-gray-700">
                  {c._count.invoices}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {formatDateTime(c.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="max-w-xl rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Provision a club</h2>
        <form action={createClub} className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs uppercase text-gray-500">Slug</span>
            <input
              type="text"
              name="slug"
              required
              pattern="[a-z0-9][a-z0-9-]*"
              placeholder="pinehurst"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase text-gray-500">Display name</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Pinehurst Country Club"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Creating…">Create</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
