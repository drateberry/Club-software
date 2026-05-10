import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { buyGuestTicket } from "./actions";

export default async function PublicEventTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { token } = await params;
  const { status } = await searchParams;

  const event = await prisma.event.findUnique({
    where: { publicToken: token },
    include: { _count: { select: { attendances: { where: { ticketPaidAt: { not: null } } } } } },
  });
  if (!event || event.deletedAt) notFound();

  const buy = buyGuestTicket.bind(null, token);
  const remaining =
    event.capacity == null ? null : event.capacity - event._count.attendances;
  const soldOut = remaining !== null && remaining <= 0;
  const price = event.guestPriceCents || event.memberPriceCents;

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{process.env.CLUB_NAME ?? "Club"}</h1>
        <p className="text-sm text-gray-600">{event.title}</p>
      </header>

      {status === "success" && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Thanks — your ticket purchase is being processed.
        </div>
      )}
      {status === "cancel" && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Purchase cancelled. You can try again below.
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <dt className="text-gray-500">When</dt>
          <dd>{formatDateTime(event.startAt)}</dd>
          {event.venue && (
            <>
              <dt className="text-gray-500">Where</dt>
              <dd>{event.venue}</dd>
            </>
          )}
          <dt className="text-gray-500">Price</dt>
          <dd className="font-medium">{formatMoney(price)}</dd>
          {remaining !== null && (
            <>
              <dt className="text-gray-500">Tickets left</dt>
              <dd>{Math.max(remaining, 0)}</dd>
            </>
          )}
        </dl>
        {event.description && (
          <p className="mt-3 whitespace-pre-wrap text-gray-700">{event.description}</p>
        )}
      </section>

      {soldOut ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          Sorry, this event is sold out.
        </div>
      ) : (
        <form action={buy} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Buy a guest ticket</h2>
          <label className="block text-sm">
            <span className="font-medium">Your name</span>
            <input
              type="text"
              name="guestName"
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              name="guestEmail"
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <SubmitButton pendingLabel="Redirecting…" className="w-full">
            Continue to checkout — {formatMoney(price)}
          </SubmitButton>
          <p className="text-xs text-gray-500">
            Members: please sign in to use member pricing instead of buying as a guest.
          </p>
        </form>
      )}
    </main>
  );
}
