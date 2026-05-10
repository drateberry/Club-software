import { getQueue, QUEUES } from "./src/lib/jobs/queue";
import { prisma } from "./src/lib/db";
import {
  generateStatements,
  startOfMonth,
  startOfNextMonth,
} from "./src/lib/houseAccounts";

async function runInstallmentReminders() {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 3);
  const due = await prisma.installment.findMany({
    where: {
      status: { in: ["PENDING", "SENT"] },
      dueDate: { lte: horizon, gte: new Date() },
    },
    include: { invoice: { include: { member: true } } },
  });
  console.log(`[worker] installment.reminder: ${due.length} due in 3 days`);
  // TODO Phase 5: enqueue email.send for each via the email provider.
  for (const inst of due) {
    console.log(
      `  - ${inst.invoice.number} #${inst.sequence} due ${inst.dueDate.toISOString().slice(0, 10)} for ${inst.invoice.member.email ?? inst.invoice.memberId}`
    );
  }
}

async function runComplianceReminders() {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const expiring = await prisma.complianceCertificate.findMany({
    where: {
      expiresOn: { lte: horizon, gte: new Date() },
      status: { not: "REVOKED" },
    },
    include: { member: true },
  });
  console.log(
    `[worker] compliance.reminder: ${expiring.length} certificates expiring in 30 days`
  );
  for (const c of expiring) {
    console.log(
      `  - ${c.type} for ${c.member.firstName} ${c.member.lastName} expires ${c.expiresOn?.toISOString().slice(0, 10)}`
    );
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

  await boss.work(QUEUES.emailSend, async (jobs) => {
    for (const job of jobs) {
      // TODO Phase 5: dispatch through email provider abstraction (SES first).
      console.log("[worker] email.send (placeholder)", job.id, job.data);
    }
  });

  await boss.work(QUEUES.installmentReminder, async () => {
    await runInstallmentReminders();
  });

  await boss.work(QUEUES.complianceReminder, async () => {
    await runComplianceReminders();
  });

  await boss.work(QUEUES.statementGenerate, async () => {
    await runMonthlyStatementBatch();
  });

  await boss.schedule(QUEUES.installmentReminder, "0 9 * * *");
  await boss.schedule(QUEUES.complianceReminder, "0 9 * * *");
  await boss.schedule(QUEUES.statementGenerate, "0 6 1 * *");

  console.log("[worker] started");
  console.log("[worker] schedules:");
  console.log("  - installment.reminder: daily 09:00");
  console.log("  - compliance.reminder:  daily 09:00");
  console.log("  - statement.generate:   1st of month, 06:00");

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
