import PgBoss from "pg-boss";

declare global {
  // eslint-disable-next-line no-var
  var __pgBoss: PgBoss | undefined;
}

export async function getQueue(): Promise<PgBoss> {
  if (!global.__pgBoss) {
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      schema: "pgboss",
    });
    boss.on("error", (err) => console.error("[pg-boss]", err));
    await boss.start();
    global.__pgBoss = boss;
  }
  return global.__pgBoss;
}

export const QUEUES = {
  installmentSendNext: "installment.send_next",
  installmentReminder: "installment.reminder",
  invoiceSend: "invoice.send",
  statementGenerate: "statement.generate",
  complianceReminder: "compliance.reminder",
  emailSend: "email.send",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
