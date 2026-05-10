import type { Tool } from "./types";
import { memberTools } from "./tools/members";
import { invoiceTools } from "./tools/invoices";
import { eventTools } from "./tools/events";
import { houseAccountTools } from "./tools/houseAccounts";
import { complianceTools } from "./tools/compliance";
import { messagingTools } from "./tools/messaging";
import { orgTools } from "./tools/groups";

export function allTools(): Tool[] {
  return [
    ...memberTools,
    ...invoiceTools,
    ...eventTools,
    ...houseAccountTools,
    ...complianceTools,
    ...messagingTools,
    ...orgTools,
  ];
}

export function findTool(name: string): Tool | null {
  return allTools().find((t) => t.name === name) ?? null;
}
