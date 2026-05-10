import { getQueue, QUEUES } from "./src/lib/jobs/queue";
import { prisma } from "./src/lib/db";
import {
  generateStatements,
  startOfMonth,
  startOfNextMonth,
} from "./src/lib/houseAccounts";
import { getEmailProvider, type EmailMessage } from "./src/lib/email";
import { ensureInstallmentPaymentLink } from "./src/lib/payments/installments";
import {
  installmentReminderEmail,
  complianceReminderEmail,
} from "./src/lib/email/templates";

const CLUB_NAME = process.env.CLUB_NAME ?? "Club OS";
const CLUB_LOCALE = process.env.CLUB_LOCALE ?? "en-US";
const CLUB_CURRENCY = process.env.CLUB_CURRENCY ?? "USD";
const PUBLIC_URL = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(CLUB_LOCALE, {
    style: "currency",
    currency: CLUB_CURRENCY,
  }).format(cents / 100);
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat(CLUB_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

async function runInstallmentReminders(boss: Awaited<ReturnType<typeof getQueue>>) {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 3);
  const due = await prisma.installment.findMany({
    where: {
      status: { in: ["PENDING", "SENT"] },
      dueDate: { lte: horizon, gte: new Date() },
    },
    include: { invoice: { include: { member: true, installments: true } } },
  });

  console.log(`[worker] installment.reminder: ${due.length} due in 3 days`);
  for (const inst of due) {
    const member = inst.invoice.member;
    if (!member.email) continue;

    const link = await ensureInstallmentPaymentLink(inst.id);
    const tpl = installmentReminderEmail({
      memberName: `${member.firstName} ${member.lastName}`,
      invoiceNumber: inst.invoice.number,
      installmentSequence: inst.sequence,
      installmentTotal: inst.invoice.installments.length,
      amountFormatted: fmtMoney(inst.amountCents + inst.adminFeeCents),
      dueDate: fmtDate(inst.dueDate),
      paymentUrl: link.url,
      clubName: CLUB_NAME,
    });

    await boss.send(QUEUES.emailSend, {
      to: member.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    } satisfies EmailMessage);
  }
}

async function runComplianceReminders(boss: Awaited<ReturnType<typeof getQueue>>) {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const expiring = await prisma.complianceCertificate.findMany({
    where: {
      expiresOn: { lte: horizon, gte: new Date() },
      status: { not: "REVOKED" },
    },
    include: { member: true },
  });

  console.log(`[worker] compliance.reminder: ${expiring.length} expiring in 30 days`);
  for (const cert of expiring) {
    if (!cert.member.email || !cert.expiresOn) continue;
    const tpl = complianceReminderEmail({
      memberName: `${cert.member.firstName} ${cert.member.lastName}`,
      certType: cert.type,
      expiresOn: fmtDate(cert.expiresOn),
      clubName: CLUB_NAME,
    });
    await boss.send(QUEUES.emailSend, {
      to: cert.member.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    } satisfies EmailMessage);
  }
}

async function runMonthlyStatementBatch() {
  const now = new Date();
  const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const end = startOfNextMonth(start);
  const result = await generateStatements(start, end);
  console.log(
    `[worker] statement.generate: created ${result.created}, skipped ${result.skipped} (period ${start.toISOString().slice(0, 10)} – ${end.toISOString().slice(0, 10)})`
  );
}

async function main() {
  const boss = await getQueue();
  await Promise.all(Object.values(QUEUES).map((q) => boss.createQueue(q)));

  const provider = getEmailProvider();
  console.log(`[worker] email provider: ${provider.name}`);
  console.log(`[worker] public url:     ${PUBLIC_URL}`);

  await boss.work(QUEUES.emailSend, async (jobs) => {
    for (const job of jobs) {
      const message = job.data as EmailMessage;
      try {
        const result = await provider.send(message);
        console.log(`[worker] email sent ${result.id} -> ${message.to}`);
      } catch (err) {
        console.error("[worker] email send failed", err);
        throw err;
      }
    }
  });

  await boss.work(QUEUES.installmentReminder, async () => {
    await runInstallmentReminders(boss);
  });

  await boss.work(QUEUES.complianceReminder, async () => {
    await runComplianceReminders(boss);
  });

  await boss.work(QUEUES.statementGenerate, async () => {
    await runMonthlyStatementBatch();
  });

  await boss.schedule(QUEUES.installmentReminder, "0 9 * * *");
  await boss.schedule(QUEUES.complianceReminder, "0 9 * * *");
  await boss.schedule(QUEUES.statementGenerate, "0 6 1 * *");

  console.log("[worker] schedules:");
  console.log("  - installment.reminder: daily 09:00");
  console.log("  - compliance.reminder:  daily 09:00");
  console.log("  - statement.generate:   1st of month, 06:00");
  console.log("[worker] started, listening for jobs");

  process.on("SIGTERM", async () => {
    console.log("[worker] SIGTERM, stopping");
    await boss.stop({ graceful: true });
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] failed to start", err);
  process.exit(1);
});
