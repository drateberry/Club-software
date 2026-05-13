import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/guards";
import { formatDateTime } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { renameClub } from "../actions";

export default async function OperatorClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOperator();
  const { id } = await params;

  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          members: true,
          invoices: true,
          events: true,
          conversations: true,
          mcpTokens: true,
        },
      },
    },
  });
  if (!club) notFound();

  const rename = renameClub.bind(null, club.id);
  const users = await prisma.user.findMany({
    where: { clubId: club.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <Link href="/operator/clubs" className="text-sm text-gray-600 hover:underline">
        ← Clubs
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{club.name}</h1>
        <p className="text-xs text-gray-500">
          slug <code>{club.slug}</code> · id <code>{club.id}</code>
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {(
          [
            ["Users", club._count.users],
            ["Members", club._count.members],
            ["Invoices", club._count.invoices],
            ["Events", club._count.events],
            ["Conversations", club._count.conversations],
            ["MCP tokens", club._count.mcpTokens],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs uppercase text-gray-500">{label}</div>
            <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
          </div>
        ))}
      </section>

      <section className="max-w-xl rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Rename</h2>
        <form action={rename} className="flex gap-2 text-sm">
          <input
            type="text"
            name="name"
            required
            defaultValue={club.name}
            className="flex-1 rounded border border-gray-300 px-3 py-2"
          />
          <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-semibold">
          Recent users
        </h2>
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No users in this club yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2 text-gray-700">{u.name}</td>
                  <td className="px-4 py-2 text-xs uppercase text-gray-600">
                    {u.role}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {formatDateTime(u.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
