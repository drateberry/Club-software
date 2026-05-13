import { prisma } from "@/lib/db";
import { rowsToCsvStream, type CsvColumn } from "./export";
import type { Capability } from "@/lib/capabilities";

export type Exporter = {
  entity: string;
  filename: () => string;
  scopes: Capability[];
  stream(): ReadableStream<Uint8Array>;
};

type MemberRow = Awaited<ReturnType<typeof memberRows>>[number];

async function memberRows() {
  return prisma.member.findMany({
    where: { deletedAt: null },
    include: { addresses: { where: { isPrimary: true }, take: 1 } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

const memberColumns: CsvColumn<MemberRow>[] = [
  { header: "memberNumber", get: (r) => r.memberNumber },
  { header: "firstName", get: (r) => r.firstName },
  { header: "lastName", get: (r) => r.lastName },
  { header: "email", get: (r) => r.email },
  { header: "phone", get: (r) => r.phone },
  { header: "membershipClass", get: (r) => r.membershipClass },
  { header: "membershipStatus", get: (r) => r.membershipStatus },
  { header: "joinDate", get: (r) => r.joinDate?.toISOString().slice(0, 10) ?? "" },
  { header: "twilioOptedOut", get: (r) => r.twilioOptedOut },
  { header: "street1", get: (r) => r.addresses[0]?.street1 ?? "" },
  { header: "street2", get: (r) => r.addresses[0]?.street2 ?? "" },
  { header: "city", get: (r) => r.addresses[0]?.city ?? "" },
  { header: "state", get: (r) => r.addresses[0]?.state ?? "" },
  { header: "zip", get: (r) => r.addresses[0]?.zip ?? "" },
];

async function* iterMembers() {
  const all = await memberRows();
  for (const row of all) yield row;
}

async function invoiceRows() {
  return prisma.invoice.findMany({
    include: { member: { select: { firstName: true, lastName: true, memberNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
}
type InvoiceRow = Awaited<ReturnType<typeof invoiceRows>>[number];

async function* iterInvoices() {
  const all = await invoiceRows();
  for (const row of all) yield row;
}

const invoiceColumns: CsvColumn<InvoiceRow>[] = [
  { header: "number", get: (r) => r.number },
  { header: "memberNumber", get: (r) => r.member.memberNumber },
  { header: "memberName", get: (r) => `${r.member.firstName} ${r.member.lastName}` },
  { header: "status", get: (r) => r.status },
  { header: "kind", get: (r) => r.kind },
  { header: "currency", get: (r) => r.currency },
  { header: "totalCents", get: (r) => r.totalCents },
  { header: "dueDate", get: (r) => r.dueDate?.toISOString().slice(0, 10) ?? "" },
  { header: "paidAt", get: (r) => r.paidAt?.toISOString() ?? "" },
  { header: "createdAt", get: (r) => r.createdAt.toISOString() },
];

type ChargeRow = Awaited<ReturnType<typeof chargeRows>>[number];

async function chargeRows() {
  return prisma.houseCharge.findMany({
    include: { member: { select: { firstName: true, lastName: true, memberNumber: true } } },
    orderBy: { occurredOn: "desc" },
  });
}

async function* iterCharges() {
  const all = await chargeRows();
  for (const row of all) yield row;
}

const chargeColumns: CsvColumn<ChargeRow>[] = [
  { header: "memberNumber", get: (r) => r.member.memberNumber },
  { header: "memberName", get: (r) => `${r.member.firstName} ${r.member.lastName}` },
  { header: "category", get: (r) => r.category },
  { header: "amountCents", get: (r) => r.amountCents },
  { header: "occurredOn", get: (r) => r.occurredOn.toISOString().slice(0, 10) },
  { header: "memo", get: (r) => r.memo },
  { header: "invoiceId", get: (r) => r.invoiceId ?? "" },
];

type EventRow = Awaited<ReturnType<typeof eventRows>>[number];

async function eventRows() {
  return prisma.event.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { attendances: true } } },
    orderBy: { startAt: "desc" },
  });
}

async function* iterEvents() {
  const all = await eventRows();
  for (const row of all) yield row;
}

const eventColumns: CsvColumn<EventRow>[] = [
  { header: "title", get: (r) => r.title },
  { header: "startAt", get: (r) => r.startAt.toISOString() },
  { header: "endAt", get: (r) => r.endAt.toISOString() },
  { header: "venue", get: (r) => r.venue },
  { header: "capacity", get: (r) => r.capacity },
  { header: "isTicketed", get: (r) => r.isTicketed },
  { header: "memberPriceCents", get: (r) => r.memberPriceCents },
  { header: "attendanceCount", get: (r) => r._count.attendances },
];

export function getExporter(entity: string): Exporter | null {
  const today = new Date().toISOString().slice(0, 10);
  switch (entity) {
    case "members":
      return {
        entity,
        filename: () => `members-${today}.csv`,
        scopes: ["members.read"],
        stream: () => rowsToCsvStream(iterMembers(), memberColumns),
      };
    case "invoices":
      return {
        entity,
        filename: () => `invoices-${today}.csv`,
        scopes: ["finance.read"],
        stream: () => rowsToCsvStream(iterInvoices() as AsyncIterable<InvoiceRow>, invoiceColumns),
      };
    case "house-charges":
      return {
        entity,
        filename: () => `house-charges-${today}.csv`,
        scopes: ["houseAccounts.read"],
        stream: () => rowsToCsvStream(iterCharges(), chargeColumns),
      };
    case "events":
      return {
        entity,
        filename: () => `events-${today}.csv`,
        scopes: ["events.read"],
        stream: () => rowsToCsvStream(iterEvents(), eventColumns),
      };
    default:
      return null;
  }
}
