import { getQueue, QUEUES } from "./src/lib/jobs/queue";

async function main() {
  const boss = await getQueue();

  await Promise.all(Object.values(QUEUES).map((q) => boss.createQueue(q)));

  await boss.work(QUEUES.emailSend, async (jobs) => {
    for (const job of jobs) {
      console.log("[worker] email.send", job.id, job.data);
    }
  });

  await boss.schedule(QUEUES.installmentReminder, "0 9 * * *");
  await boss.schedule(QUEUES.complianceReminder, "0 9 * * *");

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
