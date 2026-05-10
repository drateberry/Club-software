import { prisma } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/format";
import type { Prompt } from "./types";

const summarizeMemberActivity: Prompt = {
  name: "summarize_member_activity",
  title: "Summarize member activity",
  description: "Pulls recent activity for a member (invoices, charges, RSVPs, messages) and asks for a summary.",
  arguments: [{ name: "memberId", description: "Member ID", required: true }],
  required: ["members.read"],
  async build(args, ctx) {
    const memberId = args.memberId;
    if (ctx.user.role === "MEMBER" && ctx.user.memberId !== memberId) {
      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text: "Member not found." },
          },
        ],
      };
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        invoices: { orderBy: { createdAt: "desc" }, take: 10 },
        houseCharges: { orderBy: { occurredOn: "desc" }, take: 10 },
        eventAttendances: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { event: { select: { title: true, startAt: true } } },
        },
        conversations: {
          take: 1,
          orderBy: { lastMessageAt: "desc" },
          include: { messages: { orderBy: { createdAt: "desc" }, take: 5 } },
        },
      },
    });
    if (!member) {
      return {
        messages: [{ role: "user", content: { type: "text", text: "Member not found." } }],
      };
    }

    const lines: string[] = [];
    lines.push(`Member: ${member.firstName} ${member.lastName} (#${member.memberNumber ?? "—"}, ${member.membershipStatus}, joined ${formatDate(member.joinDate)})`);
    if (member.invoices.length > 0) {
      lines.push("\nRecent invoices:");
      for (const inv of member.invoices) {
        lines.push(`  - ${inv.number}: ${formatMoney(inv.totalCents, inv.currency)} (${inv.status})`);
      }
    }
    if (member.houseCharges.length > 0) {
      lines.push("\nRecent house charges:");
      for (const c of member.houseCharges) {
        lines.push(`  - ${formatDate(c.occurredOn)}: ${c.category} ${formatMoney(c.amountCents)}${c.memo ? ` — ${c.memo}` : ""}`);
      }
    }
    if (member.eventAttendances.length > 0) {
      lines.push("\nRecent event RSVPs:");
      for (const a of member.eventAttendances) {
        lines.push(`  - ${a.event.title} (${formatDate(a.event.startAt)}): ${a.status}${a.ticketPaidAt ? " · paid" : ""}`);
      }
    }
    const lastConvo = member.conversations[0];
    if (lastConvo) {
      lines.push("\nMost recent SMS thread:");
      for (const m of lastConvo.messages.slice().reverse()) {
        lines.push(`  ${m.direction === "OUTBOUND" ? "→" : "←"} ${m.body ?? "(media)"}`);
      }
    }

    return {
      description: `Activity summary for ${member.firstName} ${member.lastName}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Below is recent activity for a club member. Summarize their engagement, surface anything that needs follow-up, and propose two concrete next steps. Be concise.\n\n" +
              lines.join("\n"),
          },
        },
      ],
    };
  },
};

const draftPaymentReminder: Prompt = {
  name: "draft_payment_reminder",
  title: "Draft a payment reminder",
  description: "Generates a polite-but-firm payment reminder for a specific invoice. The result is meant to be reviewed and sent via SMS or email.",
  arguments: [{ name: "invoiceId", description: "Invoice ID", required: true }],
  required: ["finance.read"],
  async build(args, ctx) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: args.invoiceId },
      include: {
        member: { select: { firstName: true, lastName: true, email: true } },
        installments: { orderBy: { sequence: "asc" } },
      },
    });
    if (!invoice) {
      return {
        messages: [{ role: "user", content: { type: "text", text: "Invoice not found." } }],
      };
    }
    if (ctx.user.role === "MEMBER" && ctx.user.memberId !== invoice.memberId) {
      return {
        messages: [{ role: "user", content: { type: "text", text: "Invoice not found." } }],
      };
    }

    const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
    const overdue = invoice.dueDate ? invoice.dueDate < new Date() : false;
    const nextDue = invoice.installments.find((i) => i.status !== "PAID");
    const owingCents = nextDue
      ? nextDue.amountCents + nextDue.adminFeeCents
      : invoice.totalCents;

    const facts = [
      `Member: ${invoice.member.firstName} ${invoice.member.lastName}`,
      `Invoice: ${invoice.number}`,
      `Status: ${invoice.status}${overdue ? " (OVERDUE)" : ""}`,
      `Amount owing: ${formatMoney(owingCents, invoice.currency)}`,
      invoice.dueDate ? `Due date: ${formatDate(invoice.dueDate)}` : "",
      `Pay link: ${baseUrl}/pay/${invoice.paymentToken}`,
    ].filter(Boolean);

    return {
      description: `Reminder draft for ${invoice.number}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Draft a payment reminder for the following invoice. Tone: polite but firm if overdue. Output two versions: (1) a 320-character SMS-friendly reminder, and (2) an email with subject and body. Include the payment link.\n\n${facts.join("\n")}`,
          },
        },
      ],
    };
  },
};

const weeklyClubDigest: Prompt = {
  name: "weekly_club_digest",
  title: "Weekly club digest",
  description: "Produces a digest of activity from the last 7 days that staff can review or share.",
  arguments: [],
  required: ["members.read"],
  async build() {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [newMembers, paidInvoices, upcomingEvents, openTasks] = await Promise.all([
      prisma.member.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      prisma.invoice.count({ where: { paidAt: { gte: since } } }),
      prisma.event.findMany({
        where: { startAt: { gte: new Date() }, deletedAt: null },
        orderBy: { startAt: "asc" },
        take: 5,
        select: { title: true, startAt: true, venue: true },
      }),
      prisma.task.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    ]);

    const lines = [
      `New members this week: ${newMembers}`,
      `Invoices paid this week: ${paidInvoices}`,
      `Open tasks across staff: ${openTasks}`,
      "",
      "Upcoming events:",
      ...upcomingEvents.map(
        (e) => `  - ${e.title} (${formatDate(e.startAt)}${e.venue ? ` · ${e.venue}` : ""})`
      ),
    ];

    return {
      description: "Weekly digest covering the last 7 days.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Write a short, friendly weekly digest based on the data below. 4–6 sentences max. Highlight what's notable.\n\n${lines.join("\n")}`,
          },
        },
      ],
    };
  },
};

export const allPrompts: Prompt[] = [
  summarizeMemberActivity,
  draftPaymentReminder,
  weeklyClubDigest,
];

export function findPrompt(name: string): Prompt | null {
  return allPrompts.find((p) => p.name === name) ?? null;
}
