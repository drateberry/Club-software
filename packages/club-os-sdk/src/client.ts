import type {
  Me,
  Member,
  MemberDetail,
  InvoiceListItem,
  InvoiceDetail,
  EventListItem,
  HouseBalance,
  HouseCharge,
  Conversation,
  Message,
  CheckinLog,
  CheckinResult,
  SavedPaymentMethod,
  Paginated,
  ApiErrorBody,
  AttendanceStatus,
} from "./types";

export type ClubOSClientOptions = {
  baseUrl: string;
  /** Resolves the bearer token at call time. Return null when signed out. */
  getToken: () => Promise<string | null> | string | null;
  /** Called on 401 so the host app can clear cached tokens. */
  onUnauthorized?: () => void | Promise<void>;
};

export class ClubOSApiError extends Error {
  status: number;
  body: ApiErrorBody | string | null;
  constructor(status: number, body: ApiErrorBody | string | null, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export class ClubOSClient {
  constructor(private readonly opts: ClubOSClientOptions) {}

  private async request<T>(
    method: string,
    path: string,
    init: { query?: Record<string, string | number | boolean | undefined>; body?: unknown } = {}
  ): Promise<T> {
    const token = await this.opts.getToken();
    const url = new URL(`${this.opts.baseUrl}${path}`);
    for (const [k, v] of Object.entries(init.query ?? {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

    const text = await res.text();
    const parsed: unknown = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        })()
      : null;

    if (!res.ok) {
      if (res.status === 401) await this.opts.onUnauthorized?.();
      const message =
        typeof parsed === "object" && parsed && "error_description" in parsed
          ? (parsed as ApiErrorBody).error_description ?? `HTTP ${res.status}`
          : `HTTP ${res.status}`;
      throw new ClubOSApiError(res.status, parsed as ApiErrorBody, message);
    }

    return parsed as T;
  }

  // ── Identity ────────────────────────────────────────────────────────────
  me(): Promise<Me> {
    return this.request("GET", "/api/v1/me");
  }

  updateMe(args: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }): Promise<Member> {
    return this.request("PATCH", "/api/v1/me", { body: args });
  }

  // ── Members ─────────────────────────────────────────────────────────────
  listMembers(query: { search?: string; membershipStatus?: string; limit?: number; cursor?: string } = {}): Promise<Paginated<Member>> {
    return this.request("GET", "/api/v1/members", { query });
  }
  getMember(id: string): Promise<MemberDetail> {
    return this.request("GET", `/api/v1/members/${encodeURIComponent(id)}`);
  }

  // ── Invoices ────────────────────────────────────────────────────────────
  listInvoices(query: { status?: string; memberId?: string; limit?: number } = {}): Promise<{ data: InvoiceListItem[] }> {
    return this.request("GET", "/api/v1/invoices", { query });
  }
  getInvoice(id: string): Promise<InvoiceDetail> {
    return this.request("GET", `/api/v1/invoices/${encodeURIComponent(id)}`);
  }
  chargeInvoice(id: string): Promise<{ paymentIntentId: string; status: string; amountCents: number }> {
    return this.request("POST", `/api/v1/invoices/${encodeURIComponent(id)}/charge`);
  }
  refundInvoice(id: string, reason?: string): Promise<{ invoiceId: string; refundedCents: number; refundIds: string[] }> {
    return this.request("POST", `/api/v1/invoices/${encodeURIComponent(id)}/refund`, {
      body: reason ? { reason } : {},
    });
  }

  // ── Events ──────────────────────────────────────────────────────────────
  listEvents(query: { upcoming?: boolean; limit?: number } = {}): Promise<{ data: EventListItem[] }> {
    return this.request("GET", "/api/v1/events", { query });
  }
  rsvpEvent(id: string, status: AttendanceStatus = "GOING"): Promise<{ eventId: string; memberId: string; status: AttendanceStatus }> {
    return this.request("POST", `/api/v1/events/${encodeURIComponent(id)}/rsvp`, { body: { status } });
  }
  buyTicket(id: string): Promise<{ checkoutUrl: string; providerPaymentId: string }> {
    return this.request("POST", `/api/v1/events/${encodeURIComponent(id)}/ticket`);
  }

  // ── House accounts ──────────────────────────────────────────────────────
  getHouseBalance(memberId?: string): Promise<HouseBalance> {
    return this.request("GET", "/api/v1/house-accounts/balance", {
      query: memberId ? { memberId } : {},
    });
  }
  addHouseCharge(args: {
    memberId: string;
    category: string;
    amountCents: number;
    occurredOn?: string;
    memo?: string;
  }): Promise<HouseCharge> {
    return this.request("POST", "/api/v1/house-accounts/charges", { body: args });
  }

  // ── Messaging ───────────────────────────────────────────────────────────
  listConversations(query: { unreadOnly?: boolean; limit?: number } = {}): Promise<{ data: Conversation[] }> {
    return this.request("GET", "/api/v1/messaging/conversations", { query });
  }
  getConversation(id: string): Promise<Conversation & { messages: Message[] }> {
    return this.request("GET", `/api/v1/messaging/conversations/${encodeURIComponent(id)}/messages`);
  }
  sendMessage(conversationId: string, body: string): Promise<{ messageId: string; twilioSid: string }> {
    return this.request("POST", `/api/v1/messaging/conversations/${encodeURIComponent(conversationId)}/messages`, {
      body: { body },
    });
  }

  // ── Check-in ────────────────────────────────────────────────────────────
  recentCheckins(query: { sinceHours?: number; limit?: number } = {}): Promise<{ data: CheckinLog[] }> {
    return this.request("GET", "/api/v1/checkin", { query });
  }
  logCheckin(args: { passToken?: string; memberId?: string; note?: string }): Promise<CheckinResult> {
    return this.request("POST", "/api/v1/checkin", { body: args });
  }

  // ── Payment methods ─────────────────────────────────────────────────────
  listPaymentMethods(memberId?: string): Promise<{ data: SavedPaymentMethod[] }> {
    return this.request("GET", "/api/v1/payment-methods", {
      query: memberId ? { memberId } : {},
    });
  }
  createSetupIntent(args: { memberId?: string; forPaymentSheet?: boolean } = {}): Promise<{
    clientSecret: string;
    publishableKey: string | null;
    customerId: string;
    ephemeralKey: string | null;
  }> {
    return this.request("POST", "/api/v1/payment-methods/setup-intent", { body: args });
  }
  openCustomerPortal(args: { memberId?: string; returnUrl?: string } = {}): Promise<{ url: string }> {
    return this.request("POST", "/api/v1/payment-methods/portal", { body: args });
  }

  // ── Exports ────────────────────────────────────────────────────────────
  exportUrl(entity: "members" | "invoices" | "house-charges" | "events"): string {
    return `${this.opts.baseUrl}/api/v1/exports/${entity}`;
  }
}
