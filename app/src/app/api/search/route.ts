import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ results: [] }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const insensitive = "insensitive" as const;
  const [members, groups, committees, events] = await Promise.all([
    prisma.member.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: q, mode: insensitive } },
          { lastName: { contains: q, mode: insensitive } },
          { email: { contains: q, mode: insensitive } },
          { memberNumber: { contains: q } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, memberNumber: true },
      take: 8,
      orderBy: [{ lastName: "asc" }],
    }),
    prisma.group.findMany({
      where: { deletedAt: null, name: { contains: q, mode: insensitive } },
      select: { id: true, name: true },
      take: 5,
    }),
    prisma.committee.findMany({
      where: { deletedAt: null, name: { contains: q, mode: insensitive } },
      select: { id: true, name: true },
      take: 5,
    }),
    prisma.event.findMany({
      where: {
        deletedAt: null,
        title: { contains: q, mode: insensitive },
        startAt: { gte: new Date() },
      },
      select: { id: true, title: true, startAt: true },
      take: 5,
      orderBy: { startAt: "asc" },
    }),
  ]);

  const results = [
    ...members.map((m) => ({
      kind: "member" as const,
      id: m.id,
      label: `${m.firstName} ${m.lastName}`,
      sublabel: m.memberNumber ? `#${m.memberNumber}` : "",
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
  ];

  return NextResponse.json({ results });
}
