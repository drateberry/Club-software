// Generated-style types mirroring /api/v1/openapi.json. Keep in sync with
// the server's lib/api/openapi.ts when endpoints change.

export type Role = "ADMIN" | "STAFF" | "MEMBER";

export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "RESIGNED" | "DECEASED";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "VOID";

export type AttendanceStatus = "GOING" | "MAYBE" | "DECLINED";

export type Me = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  capabilities: string[];
  tokenScopes: string[];
  passToken: string | null;
  clubName: string;
  currency: string;
  locale: string;
  timezone: string;
  member: Member | null;
};

export type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  memberNumber: string | null;
  membershipClass: string | null;
  membershipStatus: MembershipStatus;
  joinDate: string | null;
  twilioOptedOut: boolean;
};

export type Address = {
  id: string;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  isPrimary: boolean;
};

export type MemberDetail = Member & {
  addresses: Address[];
  dependents: Array<{ id: string; name: string; relationship: string; birthDate: string | null }>;
  groupMemberships: Array<{ id: string; role: string | null; group: { id: string; name: string } }>;
  committeeMemberships: Array<{ id: string; role: string | null; committee: { id: string; name: string } }>;
};

export type Installment = {
  id: string;
  sequence: number;
  amountCents: number;
  adminFeeCents: number;
  status: "PENDING" | "SENT" | "PAID";
  dueDate: string;
  paymentLinkUrl: string | null;
  paidAt: string | null;
};

export type InvoiceListItem = {
  id: string;
  number: string;
  status: InvoiceStatus;
  kind: string;
  currency: string;
  totalCents: number;
  dueDate: string | null;
  paidAt: string | null;
  member: { firstName: string; lastName: string; memberNumber: string | null };
  installments: Installment[];
};

export type InvoiceDetail = Omit<InvoiceListItem, "member"> & {
  member: Member;
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unitCents: number;
    totalCents: number;
    kind: string;
  }>;
  payments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    method: "CARD" | "ACH" | "OTHER";
    status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
    createdAt: string;
  }>;
  paymentToken: string;
  paymentUrl: string;
};

export type EventListItem = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  venue: string | null;
  capacity: number | null;
  isTicketed: boolean;
  memberPriceCents: number;
  guestPriceCents: number;
  publicToken: string;
  _count: { attendances: number };
};

export type HouseCharge = {
  id: string;
  memberId: string;
  category: string;
  amountCents: number;
  occurredOn: string;
  memo: string | null;
  invoiceId: string | null;
};

export type HouseBalance = {
  memberId: string;
  totalCents: number;
  charges: HouseCharge[];
};

export type Conversation = {
  id: string;
  phone: string;
  unread: boolean;
  optedOut: boolean;
  lastMessageAt: string;
  member: { id: string; firstName: string; lastName: string; memberNumber: string | null } | null;
  _count: { messages: number };
};

export type Message = {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  body: string | null;
  mediaUrls: string[];
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "RECEIVED";
  twilioSid: string | null;
  errorMessage: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

export type CheckinLog = {
  id: string;
  scannedAt: string;
  notes: string | null;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    memberNumber: string | null;
    membershipStatus: MembershipStatus;
  };
};

export type CheckinResult =
  | { ok: true; memberName: string; log: CheckinLog }
  | { warning: string; membershipStatus: string; memberName: string }
  | { error: string };

export type SavedPaymentMethod = {
  id: string;
  stripePaymentMethodId: string;
  kind: "CARD" | "ACH";
  brand: string | null;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  createdAt: string;
};

export type Paginated<T> = {
  data: T[];
  nextCursor: string | null;
};

export type ApiErrorBody = {
  error: string;
  error_description?: string;
  issues?: unknown[];
};
