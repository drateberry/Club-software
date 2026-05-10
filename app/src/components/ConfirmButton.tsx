"use client";

import { useState } from "react";
import { SubmitButton } from "./SubmitButton";

export function ConfirmButton({
  message,
  confirmLabel = "Confirm",
  pendingLabel,
  variant = "danger",
  children,
}: {
  message: string;
  confirmLabel?: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded px-4 py-2 text-sm font-medium ${
          variant === "danger"
            ? "border border-red-300 bg-white text-red-700 hover:bg-red-50"
            : variant === "secondary"
              ? "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              : "bg-black text-white hover:bg-gray-800"
        }`}
      >
        {children}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm">{message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <SubmitButton variant={variant} pendingLabel={pendingLabel}>
                {confirmLabel}
              </SubmitButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
