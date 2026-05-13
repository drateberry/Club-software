import type { Tool } from "./types";
import { memberTools } from "./tools/members";
import { memberWriteTools } from "./tools/membersWrite";
import { invoiceTools } from "./tools/invoices";
import { invoiceWriteTools } from "./tools/invoicesWrite";
import { invoiceRefundTools } from "./tools/invoicesRefund";
import { eventTools } from "./tools/events";
import { eventWriteTools } from "./tools/eventsWrite";
import { houseAccountTools } from "./tools/houseAccounts";
import { houseAccountsWriteTools } from "./tools/houseAccountsWrite";
import { complianceTools } from "./tools/compliance";
import { complianceWriteTools } from "./tools/complianceWrite";
import { messagingTools } from "./tools/messaging";
import { messagingWriteTools } from "./tools/messagingWrite";
import { orgTools } from "./tools/groups";

export function allTools(): Tool[] {
  return [
    ...memberTools,
    ...memberWriteTools,
    ...invoiceTools,
    ...invoiceWriteTools,
    ...invoiceRefundTools,
    ...eventTools,
    ...eventWriteTools,
    ...houseAccountTools,
    ...houseAccountsWriteTools,
    ...complianceTools,
    ...complianceWriteTools,
    ...messagingTools,
    ...messagingWriteTools,
    ...orgTools,
  ];
}

export function findTool(name: string): Tool | null {
  return allTools().find((t) => t.name === name) ?? null;
}
