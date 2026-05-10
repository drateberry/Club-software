import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { rsvp, buyTicket } from "../actions";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      attendances: {
        include: { member: true },
        orderBy: [{ status: "asc" }],
      },
    },
  });
  if (!event || event.deletedAt) notFound();

  const myMemberId = (
    await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { memberId: true },
    })
  )?.memberId;

  const myAttendance = myMemberId
    ? event.attendances.find((a) => a.memberId === myMemberId) ?? null
    : null;

  const goingCount = event.attendances.filter(
    (a) => a.status === AttendanceStatus.GOING
  ).length;

  const canEdit = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "events.write"
  );

  const rsvpAction = rsvp.bind(null, event.id);
  const buy = buyTicket.bind(null, event.id);

  return (
    <div className="space-y-6">
      <Link href="/events" className="text-sm text-gray-600 hover:underline">
        ← Events
      </Link>

      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        {event.isTicketed && (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs uppercase text-amber-900">
            Ticketed · {formatMoney(event.memberPriceCents)}
          </span>
        )}
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <dt className="text-gray-500">Starts</dt>
          <dd>{formatDateTime(event.startAt)}</dd>
          <dt className="text-gray-500">Ends</dt>
          <dd>{formatDateTime(event.endAt)}</dd>
          {event.venue && (
            <>
              <dt className="text-gray-500">Venue</dt>
              <dd>{event.venue}</dd>
            </>
          )}
          {event.capacity && (
            <>
              <dt className="text-gray-500">Capacity</dt>
              <dd>
                {goingCount} / {event.capacity} going
              </dd>
            </>
          )}
          {event.rsvpDeadline && (
            <>
              <dt className="text-gray-500">RSVP by</dt>
              <dd>{formatDate(event.rsvpDeadline)}</dd>
            </>
          )}
        </dl>
        {event.description && (
          <p className="mt-3 whitespace-pre-wrap text-gray-700">{event.description}</p>
        )}
      </section>

      {myMemberId && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Your RSVP</h2>
          {event.isTicketed ? (
            myAttendance?.ticketPaidAt ? (
              <p className="text-sm text-green-700">
                Ticket paid {formatDateTime(myAttendance.ticketPaidAt)}.
              </p>
            ) : (
              <form action={buy}>
                <SubmitButton pendingLabel="Redirecting…">
                  Buy ticket — {formatMoney(event.memberPriceCents)}
                </SubmitButton>
                <p className="mt-2 text-xs text-gray-500">
                  You&apos;ll be redirected to Stripe Checkout.
                </p>
              </form>
            )
          ) : (
            <div className="flex flex-wrap gap-2">
              {(["GOING", "MAYBE", "DECLINED"] as const).map((status) => (
                <form key={status} action={rsvpAction}>
                  <input type="hidden" name="status" value={status} />
                  <SubmitButton
                    variant={
                      myAttendance?.status === status ? "primary" : "secondary"
                    }
                  >
                    {status === "GOING"
                      ? "I'm going"
                      : status === "MAYBE"
                        ? "Maybe"
                        : "Decline"}
                  </SubmitButton>
                </form>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Attendance ({event.attendances.length})
        </h2>
        {event.attendances.length === 0 ? (
          <p className="text-sm text-gray-500">No RSVPs yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {event.attendances.map((a) => (
              <li key={a.id} className="flex justify-between py-2">
                <span>
                  {a.member ? (
                    <Link
                      href={`/members/${a.member.id}`}
                      className="hover:underline"
                    >
                      {a.member.firstName} {a.member.lastName}
                    </Link>
                  ) : (
                    a.guestName ?? "Guest"
                  )}
                </span>
                <span className="text-gray-500">
                  {a.status}
                  {a.ticketPaidAt && " · paid"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {event.isTicketed && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Public ticket link</h2>
          <p className="break-all rounded bg-gray-50 px-3 py-2 text-xs text-gray-700">
            {process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000"}/pay/event/{event.publicToken}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Share with non-members to buy guest tickets at {formatMoney(event.guestPriceCents || event.memberPriceCents)} each.
          </p>
        </section>
      )}

      {canEdit && (
        <p className="text-xs text-gray-500">
          Edit and cancellation come in a later round.
        </p>
      )}
    </div>
  );
}
