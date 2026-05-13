import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { effectiveCapabilities, type Capability } from "@/lib/capabilities";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ results: [] }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const caps = effectiveCapabilities(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[]
  );

  const ci = "insensitive" as const;

  const promises: Array<Promise<unknown>> = [
    caps.includes("members.read")
      ? prisma.member.findMany({
          where: {
            deletedAt: null,
            OR: [
              { firstName: { contains: q, mode: ci } },
              { lastName: { contains: q, mode: ci } },
              { email: { contains: q, mode: ci } },
              { memberNumber: { contains: q } },
            ],
          },
          select: { id: true, firstName: true, lastName: true, memberNumber: true },
          take: 8,
          orderBy: [{ lastName: "asc" }],
        })
      : Promise.resolve([]),
    caps.includes("groups.read")
      ? prisma.group.findMany({
          where: { deletedAt: null, name: { contains: q, mode: ci } },
          select: { id: true, name: true },
          take: 5,
        })
      : Promise.resolve([]),
    caps.includes("committees.read")
      ? prisma.committee.findMany({
          where: { deletedAt: null, name: { contains: q, mode: ci } },
          select: { id: true, name: true },
          take: 5,
        })
      : Promise.resolve([]),
    caps.includes("events.read")
      ? prisma.event.findMany({
          where: {
            deletedAt: null,
            title: { contains: q, mode: ci },
            startAt: { gte: new Date() },
          },
          select: { id: true, title: true, startAt: true },
          take: 5,
          orderBy: { startAt: "asc" },
        })
      : Promise.resolve([]),
    caps.includes("finance.read")
      ? prisma.invoice.findMany({
          where: {
            OR: [
              { number: { contains: q, mode: ci } },
              { notes: { contains: q, mode: ci } },
              { member: { firstName: { contains: q, mode: ci } } },
              { member: { lastName: { contains: q, mode: ci } } },
            ],
          },
          select: {
            id: true,
            number: true,
            status: true,
            totalCents: true,
            currency: true,
            member: { select: { firstName: true, lastName: true } },
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    caps.includes("messaging.read")
      ? prisma.conversation.findMany({
          where: {
            OR: [
              { phone: { contains: q } },
              { member: { firstName: { contains: q, mode: ci } } },
              { member: { lastName: { contains: q, mode: ci } } },
              { messages: { some: { body: { contains: q, mode: ci } } } },
            ],
          },
          select: {
            id: true,
            phone: true,
            unread: true,
            member: { select: { firstName: true, lastName: true } },
          },
          take: 5,
          orderBy: { lastMessageAt: "desc" },
        })
      : Promise.resolve([]),
    caps.includes("houseAccounts.read")
      ? prisma.houseCharge.findMany({
          where: {
            OR: [
              { memo: { contains: q, mode: ci } },
              { category: { contains: q, mode: ci } },
              { member: { firstName: { contains: q, mode: ci } } },
              { member: { lastName: { contains: q, mode: ci } } },
            ],
          },
          select: {
            id: true,
            category: true,
            amountCents: true,
            occurredOn: true,
            memberId: true,
            memo: true,
            member: { select: { firstName: true, lastName: true } },
          },
          take: 5,
          orderBy: { occurredOn: "desc" },
        })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: ci } },
          { description: { contains: q, mode: ci } },
        ],
        ...(session.user.role === "MEMBER"
          ? { assigneeId: session.user.id }
          : {}),
      },
      select: { id: true, title: true, status: true },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
  ];

  type MemberRow = { id: string; firstName: string; lastName: string; memberNumber: string | null };
  type GroupRow = { id: string; name: string };
  type EventRow = { id: string; title: string; startAt: Date };
  type InvoiceRow = {
    id: string;
    number: string;
    status: string;
    totalCents: number;
    currency: string;
    member: { firstName: string; lastName: string };
  };
  type ConvoRow = {
    id: string;
    phone: string;
    unread: boolean;
    member: { firstName: string; lastName: string } | null;
  };
  type ChargeRow = {
    id: string;
    category: string;
    amountCents: number;
    occurredOn: Date;
    memberId: string;
    memo: string | null;
    member: { firstName: string; lastName: string };
  };
  type TaskRow = { id: string; title: string; status: string };

  const [members, groups, committees, events, invoices, conversations, charges, tasks] =
    (await Promise.all(promises)) as [
      MemberRow[],
      GroupRow[],
      GroupRow[],
      EventRow[],
      InvoiceRow[],
      ConvoRow[],
      ChargeRow[],
      TaskRow[],
    ];

  const fmtMoney = (cents: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  const results = [
    ...members.map((m) => ({
      kind: "member" as const,
      id: m.id,
      label: `${m.firstName} ${m.lastName}`,
      sublabel: m.memberNumber ? `#${m.memberNumber}` : "Member",
      href: `/members/${m.id}`,
    })),
    ...groups.map((g) => ({
      kind: "group" as const,
      id: g.id,
      label: g.name,
      sublabel: "Group",
      href: `/groups/${g.id}`,
    })),
    ...committees.map((c) => ({
      kind: "committee" as const,
      id: c.id,
      label: c.name,
      sublabel: "Committee",
      href: `/committees/${c.id}`,
    })),
    ...events.map((e) => ({
      kind: "event" as const,
      id: e.id,
      label: e.title,
      sublabel: new Date(e.startAt).toLocaleDateString(),
      href: `/events/${e.id}`,
    })),
    ...invoices.map((inv) => ({
      kind: "invoice" as const,
      id: inv.id,
      label: `${inv.number} · ${inv.member.firstName} ${inv.member.lastName}`,
      sublabel: `${fmtMoney(inv.totalCents, inv.currency)} · ${inv.status}`,
      href: `/finance/invoices/${inv.id}`,
    })),
    ...conversations.map((c) => ({
      kind: "conversation" as const,
      id: c.id,
      label: c.member ? `${c.member.firstName} ${c.member.lastName}` : c.phone,
      sublabel: c.unread ? "Unread thread" : "Thread",
      href: `/messages/${c.id}`,
    })),
    ...charges.map((c) => ({
      kind: "house_charge" as const,
      id: c.id,
      label: `${c.member.firstName} ${c.member.lastName} · ${c.category}`,
      sublabel: `${fmtMoney(c.amountCents, "USD")}${c.memo ? ` — ${c.memo}` : ""}`,
      href: `/house-accounts/${c.memberId}`,
    })),
    ...tasks.map((t) => ({
      kind: "task" as const,
      id: t.id,
      label: t.title,
      sublabel: `Task · ${t.status}`,
      href: `/tasks`,
    })),
  ];

  return NextResponse.json({ results });
}
