"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MembershipStatus } from "@prisma/client";
import { bulkSendSmsToMembers, bulkUpdateMembers, updateMemberField } from "./actions";

type Row = {
  id: string;
  memberNumber: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  membershipClass: string | null;
  membershipStatus: MembershipStatus;
  joinDateFormatted: string;
};

type EditingCell = { id: string; field: keyof Row } | null;

const STATUSES: MembershipStatus[] = ["ACTIVE", "SUSPENDED", "RESIGNED", "DECEASED"];

export function MembersTable({
  rows: initialRows,
  canWrite,
  canBulkSendSms,
}: {
  rows: Row[];
  canWrite: boolean;
  canBulkSendSms: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingCell>(null);
  const [pending, startTransition] = useTransition();
  const [composing, setComposing] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  const [smsResult, setSmsResult] = useState<string | null>(null);

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected]
  );

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const saveCell = (id: string, field: keyof Row, value: string) => {
    const previous = rows.find((r) => r.id === id)?.[field];
    if (String(previous ?? "") === value) {
      setEditing(null);
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value || null } : r))
    );
    setEditing(null);
    startTransition(async () => {
      try {
        await updateMemberField(
          id,
          field as "email" | "phone" | "memberNumber" | "membershipClass" | "membershipStatus",
          value
        );
      } catch {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, [field]: previous ?? null } : r))
        );
      }
    });
  };

  const runBulk = (action: "activate" | "suspend" | "delete") => {
    if (selected.size === 0) return;
    if (action === "delete" && !confirm(t("members.confirmDelete"))) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkUpdateMembers({ ids, action });
      setSelected(new Set());
      router.refresh();
    });
  };

  const sendBulkSms = () => {
    const body = smsBody.trim();
    if (!body || selected.size === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await bulkSendSmsToMembers({ ids, body });
      setSmsResult(
        `Queued ${result.enqueued} of ${result.total}` +
          (result.skippedNoPhone ? ` · ${result.skippedNoPhone} no phone` : "") +
          (result.skippedOptedOut ? ` · ${result.skippedOptedOut} opted out` : "")
      );
      setSmsBody("");
      setComposing(false);
      router.refresh();
    });
  };

  const editableField = (
    row: Row,
    field: "memberNumber" | "email" | "phone" | "membershipClass"
  ) => {
    const isEditing = editing?.id === row.id && editing.field === field;
    const display = (row[field] ?? "") as string;
    if (!canWrite) return <span className="text-gray-600">{display}</span>;
    if (isEditing) {
      return (
        <input
          autoFocus
          defaultValue={display}
          onBlur={(e) => saveCell(row.id, field, e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = display;
              setEditing(null);
            }
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      );
    }
    return (
      <button
        type="button"
        onClick={() => setEditing({ id: row.id, field })}
        className="block w-full text-left text-gray-700 hover:text-black"
      >
        {display || <span className="text-gray-300">—</span>}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {smsResult && (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {smsResult}
          <button
            type="button"
            onClick={() => setSmsResult(null)}
            className="ml-3 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {selected.size > 0 && canWrite && (
        <div className="space-y-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">{selected.size} selected</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => runBulk("activate")}
                disabled={pending}
                className="rounded border border-gray-300 px-3 py-1"
              >
                Activate
              </button>
              <button
                type="button"
                onClick={() => runBulk("suspend")}
                disabled={pending}
                className="rounded border border-gray-300 px-3 py-1"
              >
                Suspend
              </button>
              {canBulkSendSms && (
                <button
                  type="button"
                  onClick={() => setComposing((v) => !v)}
                  disabled={pending}
                  className="rounded border border-gray-300 px-3 py-1"
                >
                  Send SMS
                </button>
              )}
              <button
                type="button"
                onClick={() => runBulk("delete")}
                disabled={pending}
                className="rounded border border-red-300 px-3 py-1 text-red-700"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded px-3 py-1 text-gray-500"
              >
                Clear
              </button>
            </div>
          </div>

          {composing && canBulkSendSms && (
            <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
              <textarea
                rows={3}
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                placeholder={`Type a message to ${selected.size} member${selected.size === 1 ? "" : "s"}…`}
                className="block w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {smsBody.length}/1600 chars
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setComposing(false);
                      setSmsBody("");
                    }}
                    disabled={pending}
                    className="rounded border border-gray-300 px-3 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={sendBulkSms}
                    disabled={pending || !smsBody.trim()}
                    className="rounded bg-black px-3 py-1 font-medium text-white disabled:opacity-50"
                  >
                    {pending ? "Queuing…" : `Send to ${selected.size}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              {canWrite && (
                <th className="w-10 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="px-4 py-2">{t("members.memberNumber")}</th>
              <th className="px-4 py-2">{t("members.name")}</th>
              <th className="px-4 py-2">{t("members.class")}</th>
              <th className="px-4 py-2">{t("members.status")}</th>
              <th className="px-4 py-2">{t("members.email")}</th>
              <th className="px-4 py-2">{t("members.phone")}</th>
              <th className="px-4 py-2">{t("members.joined")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 8 : 7} className="px-4 py-6 text-center text-gray-500">
                  {t("members.noResults")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {canWrite && (
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.firstName} ${row.lastName}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2">{editableField(row, "memberNumber")}</td>
                  <td className="px-4 py-2">
                    <Link href={`/members/${row.id}`} className="hover:underline">
                      {row.firstName} {row.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{editableField(row, "membershipClass")}</td>
                  <td className="px-4 py-2">
                    {canWrite ? (
                      <select
                        value={row.membershipStatus}
                        onChange={(e) =>
                          saveCell(row.id, "membershipStatus", e.target.value)
                        }
                        className="rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-700">{row.membershipStatus}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{editableField(row, "email")}</td>
                  <td className="px-4 py-2">{editableField(row, "phone")}</td>
                  <td className="px-4 py-2 text-gray-500">{row.joinDateFormatted}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
