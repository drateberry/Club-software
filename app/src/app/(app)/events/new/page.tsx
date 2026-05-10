import Link from "next/link";
import { requireCapability } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { createEvent } from "../actions";

export default async function NewEventPage() {
  await requireCapability("events.write");
  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/events" className="text-sm text-gray-600 hover:underline">
        ← Events
      </Link>
      <h1 className="text-2xl font-semibold">New event</h1>
      <form action={createEvent} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <label className="block text-sm">
          <span className="font-medium">Title</span>
          <input
            type="text"
            name="title"
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Description</span>
          <textarea
            name="description"
            rows={3}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">Starts</span>
            <input
              type="datetime-local"
              name="startAt"
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Ends</span>
            <input
              type="datetime-local"
              name="endAt"
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium">Venue</span>
          <input
            type="text"
            name="venue"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">Capacity (optional)</span>
            <input
              type="number"
              name="capacity"
              min={0}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">RSVP deadline</span>
            <input
              type="datetime-local"
              name="rsvpDeadline"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isTicketed" />
          <span>Ticketed event (members pay to attend)</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">Member price</span>
            <input
              type="number"
              name="memberPrice"
              step="0.01"
              min={0}
              placeholder="0.00"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Guest price</span>
            <input
              type="number"
              name="guestPrice"
              step="0.01"
              min={0}
              placeholder="0.00"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Link href="/events" className="rounded border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </Link>
          <SubmitButton pendingLabel="Creating…">Create</SubmitButton>
        </div>
      </form>
    </div>
  );
}
