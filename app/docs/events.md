# Events

## Two flows

**Member RSVP / ticket purchase** — signed-in member opens the event detail
page at `/events/{id}`, RSVPs (free events) or buys a ticket (ticketed
events) via Stripe Checkout. The member-side and admin-side both live under
the authed `(app)` route group.

**Guest ticket purchase** — anyone with the public link
`/pay/event/{publicToken}` can buy a ticket without an account. They enter
name + email, redirect to Stripe Checkout, attendance is recorded with
`memberId: null` and `guestName` / `guestEmail` set.

## Capacity enforcement

Capacity is enforced inside a Postgres transaction with `SELECT … FOR
UPDATE` on the Event row. Concurrent RSVPs and ticket purchases serialize
on that row — six concurrent buyers for a 5-seat event will see five
succeed and one get an error.

```ts
await prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;

  const ticketed = await tx.eventAttendance.count({
    where: { eventId, ticketPaidAt: { not: null } },
  });
  if (ticketed >= event.capacity) throw new Error("Event is sold out");

  const attendance = await tx.eventAttendance.upsert(...);
});
```

Note for ticketed events the gate is on `ticketPaidAt: { not: null }`, not
`status === GOING`. Reserving a ticket without paying doesn't take a seat.

## Ticket payment

`buyTicket` (member) and `buyGuestTicket` (public) both call into the
`PaymentProvider` with `metadata.attendanceId`. The Stripe webhook flips
`EventAttendance.ticketPaidAt` to `now()` — see [`payments.md`](payments.md).

Successful return goes to `/events/{id}?ok=Ticket%20purchased` (member) or
`/pay/event/{token}?status=success` (guest). Cancellation returns to the
same page with `status=cancel`.

## Pricing

`memberPriceCents` and `guestPriceCents` are stored separately on the
Event. The public page falls back to `memberPriceCents` if `guestPriceCents`
is zero — a reasonable default for events that don't price-discriminate.

## RSVP-only events

Events with `isTicketed: false` show three RSVP buttons (Going / Maybe /
Decline) instead of the Pay button. Free RSVPs don't run through Stripe at
all.

## What's not built (yet)

- Cancel a ticket (refund flow)
- Guest list export for the event night
- Reminder emails to attendees
- iCal export per event
- Edit event after creation
