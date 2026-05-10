import { z } from "zod";
import { ComplianceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { makeTool, textResult, errorResult, type Tool } from "../types";

const createCert = makeTool({
  name: "compliance.create",
  description: "Add a compliance certificate (e.g. background check, first-aid renewal).",
  required: ["compliance.write"],
  inputSchema: z.object({
    memberId: z.string().min(1),
    type: z.string().min(1).max(200),
    status: z.nativeEnum(ComplianceStatus).default(ComplianceStatus.CERTIFIED),
    certifiedOn: z.string().optional(),
    expiresOn: z.string().optional(),
    notes: z.string().max(2000).optional(),
  }),
  async handler(input, ctx) {
    if (ctx.user.role === "MEMBER") return errorResult("Members cannot manage compliance");
    const cert = await prisma.complianceCertificate.create({
      data: {
        memberId: input.memberId,
        type: input.type,
        status: input.status ?? ComplianceStatus.CERTIFIED,
        certifiedOn: input.certifiedOn ? new Date(input.certifiedOn) : null,
        expiresOn: input.expiresOn ? new Date(input.expiresOn) : null,
        notes: input.notes ?? null,
      },
    });
    await logAudit(ctx.user.id, "compliance.create", "ComplianceCertificate", cert.id, {
      source: "mcp",
    });
    return textResult(`Added ${input.type} for member.`, cert);
  },
});

export const complianceWriteTools: Tool[] = [createCert as unknown as Tool];
