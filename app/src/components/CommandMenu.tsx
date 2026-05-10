"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type Result = {
  kind: "member" | "group" | "committee" | "event";
  id: string;
  label: string;
  sublabel: string;
  href: string;
};

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const openMenu = () => {
    setQ("");
    setResults([]);
    setActive(0);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openMenu();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        if (cancelled) return;
        setResults(json.results ?? []);
        setActive(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, open]);

  const select = (r: Result) => {
    setOpen(false);
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      select(results[active]);
    }
  };

  if (!open) return null;

  const trimmed = q.trim();
  const showResults = trimmed.length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search members, groups, committees, events…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          {loading && <span className="text-xs text-gray-400">…</span>}
          <kbd className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
            esc
          </kbd>
        </div>
        <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
          {showResults && results.length === 0 && !loading && (
            <li className="px-4 py-6 text-center text-sm text-gray-500">
              No results.
            </li>
          )}
          {showResults &&
            results.map((r, idx) => (
              <li key={`${r.kind}-${r.id}`}>
                <button
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => select(r)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${
                    idx === active ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="flex-1">{r.label}</span>
                  <span className="text-xs text-gray-500">{r.sublabel}</span>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
