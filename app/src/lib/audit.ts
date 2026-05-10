import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AuditAction =
  | "member.create"
  | "member.update"
  | "member.delete"
  | "member.bulkUpdate"
  | "invoice.create"
  | "invoice.send"
  | "invoice.void"
  | "invoice.paid"
  | "compliance.create"
  | "compliance.delete"
  | "houseCharge.create"
  | "houseCharge.delete"
  | "statement.batchRun"
  | "event.create"
  | "pass.issue"
  | "checkin.log"
  | "settings.update";

export type AuditEntity =
  | "Member"
  | "Invoice"
  | "ComplianceCertificate"
  | "HouseCharge"
  | "Statement"
  | "Event"
  | "User"
  | "CheckinLog"
  | "Setting";

export async function logAudit(
  actorId: string | null | undefined,
  action: AuditAction,
  entity: AuditEntity,
  entityId: string,
  diff?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: actorId ?? null,
        action,
        entity,
        entityId,
        diffJson: diff ? (diff as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write event", err);
  }
}
