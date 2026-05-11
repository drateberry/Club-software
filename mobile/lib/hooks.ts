import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type Me = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "STAFF" | "MEMBER";
  capabilities: string[];
  tokenScopes: string[];
  passToken: string | null;
  clubName: string;
  currency: string;
  locale: string;
  timezone: string;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    memberNumber: string | null;
    membershipClass: string | null;
    membershipStatus: "ACTIVE" | "SUSPENDED" | "RESIGNED" | "DECEASED";
  } | null;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/api/v1/me"),
  });
}

export type InvoiceListItem = {
  id: string;
  number: string;
  status: "DRAFT" | "SENT" | "PAID" | "VOID";
  kind: string;
  currency: string;
  totalCents: number;
  dueDate: string | null;
  paidAt: string | null;
  member: { firstName: string; lastName: string; memberNumber: string | null };
  installments: Array<{
    id: string;
    sequence: number;
    amountCents: number;
    status: "PENDING" | "SENT" | "PAID";
    dueDate: string;
  }>;
};

export function useInvoices(opts: { status?: string; memberId?: string } = {}) {
  const search = new URLSearchParams();
  if (opts.status) search.set("status", opts.status);
  if (opts.memberId) search.set("memberId", opts.memberId);
  const qs = search.toString();
  return useQuery({
    queryKey: ["invoices", opts],
    queryFn: () => api<{ data: InvoiceListItem[] }>(`/api/v1/invoices${qs ? `?${qs}` : ""}`),
  });
}

export type EventListItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  venue: string | null;
  capacity: number | null;
  isTicketed: boolean;
  memberPriceCents: number;
  _count: { attendances: number };
};

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => api<{ data: EventListItem[] }>("/api/v1/events?upcoming=true"),
  });
}

export function useRsvpEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: "GOING" | "MAYBE" | "DECLINED" }) =>
      api(`/api/v1/events/${eventId}/rsvp`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useBuyTicket() {
  return useMutation({
    mutationFn: ({ eventId }: { eventId: string }) =>
      api<{ checkoutUrl: string }>(`/api/v1/events/${eventId}/ticket`, { method: "POST" }),
  });
}

export function useHouseBalance(memberId?: string) {
  const qs = memberId ? `?memberId=${memberId}` : "";
  return useQuery({
    queryKey: ["house-balance", memberId],
    queryFn: () =>
      api<{ memberId: string; totalCents: number; charges: Array<{ id: string; category: string; amountCents: number; occurredOn: string; memo: string | null }> }>(
        `/api/v1/house-accounts/balance${qs}`
      ),
  });
}

export type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  memberNumber: string | null;
  membershipClass: string | null;
  membershipStatus: "ACTIVE" | "SUSPENDED" | "RESIGNED" | "DECEASED";
  twilioOptedOut: boolean;
};

export function useMembers(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return useQuery({
    queryKey: ["members", search],
    queryFn: () => api<{ data: Member[]; nextCursor: string | null }>(`/api/v1/members${qs}`),
  });
}

export type ConversationItem = {
  id: string;
  phone: string;
  unread: boolean;
  optedOut: boolean;
  lastMessageAt: string;
  member: { id: string; firstName: string; lastName: string } | null;
  _count: { messages: number };
};

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<{ data: ConversationItem[] }>("/api/v1/messaging/conversations"),
  });
}

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ passToken, memberId }: { passToken?: string; memberId?: string }) =>
      api<
        | { ok: true; memberName: string }
        | { warning: string; membershipStatus: string; memberName: string }
        | { error: string }
      >("/api/v1/checkin", {
        method: "POST",
        body: JSON.stringify({ passToken, memberId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checkin-recent"] }),
  });
}

export function useRecentCheckins() {
  return useQuery({
    queryKey: ["checkin-recent"],
    queryFn: () => api<{ data: Array<{ id: string; scannedAt: string; member: { firstName: string; lastName: string } }> }>("/api/v1/checkin"),
  });
}

export function useOpenCustomerPortal() {
  return useMutation({
    mutationFn: ({ returnUrl }: { returnUrl?: string }) =>
      api<{ url: string }>("/api/v1/payment-methods/portal", {
        method: "POST",
        body: JSON.stringify({ returnUrl: returnUrl ?? "" }),
      }),
  });
}
