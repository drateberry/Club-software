"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { submitFeedback } from "@/app/(app)/feedback-actions";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();

  const submit = () => {
    if (!message.trim()) return;
    startTransition(async () => {
      await submitFeedback({ message: message.trim(), page: pathname });
      setMessage("");
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
      }, 1200);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 shadow hover:bg-gray-50"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold">Share feedback</div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="What worked, what didn't, what would help…"
              className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              autoFocus
              disabled={pending || done}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span className="truncate">Page: {pathname}</span>
              {done && <span className="text-green-600">Sent ✓</span>}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || done || !message.trim()}
                className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
