"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type Toast = { id: string; tone: "success" | "error"; message: string };

export function Toaster() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const ok = params.get("ok");
    const err = params.get("err");
    if (!ok && !err) return;

    const id = `${Date.now()}-${Math.random()}`;

    queueMicrotask(() => {
      setToasts((prev) => [
        ...prev,
        ok
          ? { id, tone: "success", message: ok }
          : { id, tone: "error", message: err! },
      ]);
    });

    const next = new URLSearchParams(params.toString());
    next.delete("ok");
    next.delete("err");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);

    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
    return () => clearTimeout(t);
  }, [params, pathname, router]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded border px-4 py-3 text-sm shadow ${
            t.tone === "success"
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {t.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4" />
          )}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-current opacity-60 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
