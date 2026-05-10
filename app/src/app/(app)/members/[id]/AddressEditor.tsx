"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addAddress, deleteAddress } from "../actions";

type Address = {
  id: string;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  isPrimary: boolean;
};

export function AddressEditor({
  memberId,
  addresses,
  canWrite,
}: {
  memberId: string;
  addresses: Address[];
  canWrite: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const onAdd = (formData: FormData) => {
    startTransition(async () => {
      await addAddress(memberId, formData);
      setAdding(false);
    });
  };

  const onDelete = (addressId: string) => {
    startTransition(async () => {
      await deleteAddress(memberId, addressId);
    });
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Addresses</h2>
        {canWrite && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
          >
            <Plus className="h-3.5 w-3.5" /> Add address
          </button>
        )}
      </div>

      {addresses.length === 0 && !adding && (
        <p className="text-sm text-gray-500">No addresses on file.</p>
      )}

      {addresses.length > 0 && (
        <ul className="space-y-2 text-sm">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between rounded border border-gray-100 p-3"
            >
              <div>
                <div>{a.street1}</div>
                {a.street2 && <div>{a.street2}</div>}
                <div className="text-gray-600">
                  {a.city}, {a.state} {a.zip}
                </div>
                {a.isPrimary && (
                  <div className="mt-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-600">
                    Primary
                  </div>
                )}
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  disabled={pending}
                  className="text-gray-400 hover:text-red-600"
                  aria-label="Delete address"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form action={onAdd} className="mt-3 space-y-2 rounded border border-gray-200 p-3 text-sm">
          <input
            type="text"
            name="street1"
            placeholder="Street address"
            required
            className="block w-full rounded border border-gray-300 px-2 py-1.5"
          />
          <input
            type="text"
            name="street2"
            placeholder="Apt / Suite (optional)"
            className="block w-full rounded border border-gray-300 px-2 py-1.5"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              name="city"
              placeholder="City"
              required
              className="rounded border border-gray-300 px-2 py-1.5"
            />
            <input
              type="text"
              name="state"
              placeholder="State"
              required
              maxLength={2}
              className="rounded border border-gray-300 px-2 py-1.5 uppercase"
            />
            <input
              type="text"
              name="zip"
              placeholder="ZIP"
              required
              className="rounded border border-gray-300 px-2 py-1.5"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Add"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
