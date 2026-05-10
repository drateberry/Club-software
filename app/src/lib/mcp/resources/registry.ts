import { prisma } from "@/lib/db";
import { jsonResource, templateMatcher, type Resource, type ResourceTemplate } from "./types";

const dashboardStats: Resource = {
  uri: "clubos://dashboard/stats",
  name: "Dashboard stats",
  description:
    "Top-line club stats: active member count, open invoices, outstanding balance, upcoming events.",
  mimeType: "application/json",
  required: ["members.read"],
  async read(ctx) {
    const baseMemberWhere =
      ctx.user.role === "MEMBER" && ctx.user.memberId
        ? { id: ctx.user.memberId }
        : { membershipStatus: "ACTIVE" as const, deletedAt: null };

    const [activeMembers, openInvoices, outstandingAgg, upcomingEvents] = await Promise.all([
      prisma.member.count({ where: baseMemberWhere }),
      prisma.invoice.count({
        where: {
          status: "SENT",
          ...(ctx.user.role === "MEMBER" && ctx.user.memberId
            ? { memberId: ctx.user.memberId }
            : {}),
        },
      }),
      prisma.invoice.aggregate({
        _sum: { totalCents: true },
        where: {
          status: "SENT",
          ...(ctx.user.role === "MEMBER" && ctx.user.memberId
            ? { memberId: ctx.user.memberId }
            : {}),
        },
      }),
      prisma.event.count({
        where: { deletedAt: null, startAt: { gte: new Date() } },
      }),
    ]);

    return jsonResource({
      activeMembers,
      openInvoices,
      outstandingBalanceCents: outstandingAgg._sum.totalCents ?? 0,
      upcomingEvents,
      generatedAt: new Date().toISOString(),
      scope: ctx.user.role === "MEMBER" ? "self" : "club",
    });
  },
};

const expiringCompliance: Resource = {
  uri: "clubos://compliance/expiring",
  name: "Expiring compliance certificates",
  description: "Certificates expiring in the next 90 days.",
  mimeType: "application/json",
  required: ["compliance.read"],
  async read(ctx) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 90);
    const certs = await prisma.complianceCertificate.findMany({
      where: {
        expiresOn: { lte: horizon, gte: new Date() },
        status: { not: "REVOKED" },
        ...(ctx.user.role === "MEMBER" && ctx.user.memberId
          ? { memberId: ctx.user.memberId }
          : {}),
      },
      include: { member: { select: { firstName: true, lastName: true } } },
      orderBy: { expiresOn: "asc" },
    });
    return jsonResource(certs);
  },
};

export const staticResources: Resource[] = [dashboardStats, expiringCompliance];

const memberById: ResourceTemplate = {
  uriTemplate: "clubos://members/{id}",
  name: "Member profile",
  description:
    "Full member record by ID with addresses, dependents, and active group/committee memberships.",
  mimeType: "application/json",
  required: ["members.read"],
  match: templateMatcher("clubos://members/{id}"),
  async read(params, ctx) {
    const id = params.id;
    if (ctx.user.role === "MEMBER" && ctx.user.memberId !== id) {
      return jsonResource({ error: "Not found" });
    }
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        addresses: true,
        dependents: true,
        groupMemberships: { include: { group: { select: { id: true, name: true } } } },
        committeeMemberships: {
          include: { committee: { select: { id: true, name: true } } },
        },
      },
    });
    if (!member || member.deletedAt) return jsonResource({ error: "Not found" });
    return jsonResource(member);
  },
};

const invoiceById: ResourceTemplate = {
  uriTemplate: "clubos://invoices/{id}",
  name: "Invoice",
  description: "Full invoice with line items, installments, and payments.",
  mimeType: "application/json",
  required: ["finance.read"],
  match: templateMatcher("clubos://invoices/{id}"),
  async read(params, ctx) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        member: true,
        lines: true,
        installments: { orderBy: { sequence: "asc" } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!invoice) return jsonResource({ error: "Not found" });
    if (ctx.user.role === "MEMBER" && ctx.user.memberId !== invoice.memberId) {
      return jsonResource({ error: "Not found" });
    }
    return jsonResource(invoice);
  },
};

const eventById: ResourceTemplate = {
  uriTemplate: "clubos://events/{id}",
  name: "Event detail",
  description: "Event with attendee roster.",
  mimeType: "application/json",
  required: ["events.read"],
  match: templateMatcher("clubos://events/{id}"),
  async read(params) {
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        attendances: {
          include: { member: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    if (!event || event.deletedAt) return jsonResource({ error: "Not found" });
    return jsonResource(event);
  },
};

const houseAccountByMember: ResourceTemplate = {
  uriTemplate: "clubos://house-accounts/{memberId}/balance",
  name: "House-account balance",
  description: "Unbilled charges + total for a member.",
  mimeType: "application/json",
  required: ["houseAccounts.read"],
  match: templateMatcher("clubos://house-accounts/{memberId}/balance"),
  async read(params, ctx) {
    if (ctx.user.role === "MEMBER" && ctx.user.memberId !== params.memberId) {
      return jsonResource({ error: "Not found" });
    }
    const charges = await prisma.houseCharge.findMany({
      where: { memberId: params.memberId, invoiceId: null },
      orderBy: { occurredOn: "desc" },
    });
    const totalCents = charges.reduce((s, c) => s + c.amountCents, 0);
    return jsonResource({ memberId: params.memberId, totalCents, charges });
  },
};

const conversationById: ResourceTemplate = {
  uriTemplate: "clubos://conversations/{id}",
  name: "SMS conversation",
  description: "An SMS conversation thread with full message history.",
  mimeType: "application/json",
  required: ["messaging.read"],
  match: templateMatcher("clubos://conversations/{id}"),
  async read(params) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!conversation) return jsonResource({ error: "Not found" });
    return jsonResource(conversation);
  },
};

export const resourceTemplates: ResourceTemplate[] = [
  memberById,
  invoiceById,
  eventById,
  houseAccountByMember,
  conversationById,
];

export function findResource(uri: string) {
  return staticResources.find((r) => r.uri === uri) ?? null;
}

export function findTemplateMatch(uri: string) {
  for (const t of resourceTemplates) {
    const params = t.match(uri);
    if (params) return { template: t, params };
  }
  return null;
}
