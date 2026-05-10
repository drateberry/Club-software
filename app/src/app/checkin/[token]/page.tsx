import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { formatDateTime } from "@/lib/format";
import { logCheckin } from "@/app/(app)/checkin/actions";

export default async function CheckinTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { token } = await params;
  const { ok, err } = await searchParams;

  const user = await prisma.user.findUnique({
    where: { passToken: token },
    include: { member: true },
  });
  if (!user?.member) notFound();

  const session = await auth();
  const isStaff =
    session?.user &&
    hasCapability(
      session.user.role,
      (session.user.capabilities ?? []) as Capability[],
      "checkin.scan"
    );

  const lastCheckin = await prisma.checkinLog.findFirst({
    where: { memberId: user.member.id },
    orderBy: { scannedAt: "desc" },
  });

  const submit = logCheckin.bind(null, token);
  const member = user.member;
  const status = member.membershipStatus;

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <header className="text-center">
        <h1 className="text-xl font-semibold">{process.env.CLUB_NAME ?? "Club"}</h1>
        <p className="text-sm text-gray-600">Member pass</p>
      </header>

      <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-6 text-center">
        <div className="text-2xl font-semibold">
          {member.firstName} {member.lastName}
        </div>
        {member.memberNumber && (
          <div className="text-sm text-gray-500">#{member.memberNumber}</div>
        )}
        <div
          className={`inline-block rounded px-2 py-0.5 text-xs uppercase ${
            status === "ACTIVE"
              ? "bg-green-100 text-green-900"
              : "bg-red-100 text-red-900"
          }`}
        >
          {status}
        </div>
        {lastCheckin && (
          <div className="text-xs text-gray-500">
            Last check-in: {formatDateTime(lastCheckin.scannedAt)}
          </div>
        )}
      </section>

      {ok && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-center text-sm text-green-900">
          {ok}
        </div>
      )}
      {err && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-center text-sm text-red-900">
          {err}
        </div>
      )}

      {isStaff ? (
        status === "ACTIVE" ? (
          <form action={submit} className="space-y-3">
            <input
              type="text"
              name="note"
              placeholder="Note (optional, e.g. 'guest of honor')"
              className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded bg-black py-3 text-base font-medium text-white"
            >
              Confirm check-in
            </button>
          </form>
        ) : (
          <p className="rounded border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-900">
            This member is not active. Override needed.
          </p>
        )
      ) : (
        <p className="rounded border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-600">
          Sign in as staff to check this member in.
        </p>
      )}
    </main>
  );
}
