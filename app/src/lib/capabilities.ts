export type Role = "OPERATOR" | "ADMIN" | "STAFF" | "MEMBER";

export type Capability =
  | "members.read"
  | "members.write"
  | "groups.read"
  | "groups.write"
  | "committees.read"
  | "committees.write"
  | "events.read"
  | "events.write"
  | "finance.read"
  | "finance.write"
  | "houseAccounts.read"
  | "houseAccounts.write"
  | "compliance.read"
  | "compliance.write"
  | "checkin.scan"
  | "settings.write"
  | "messaging.read"
  | "messaging.write"
  | "messaging.bulkSend"
  | "payments.chargeOnFile"
  | "operator.clubs"
  | "operator.audit";

const ADMIN_IMPLIED: Capability[] = [
  "members.read",
  "members.write",
  "groups.read",
  "groups.write",
  "committees.read",
  "committees.write",
  "events.read",
  "events.write",
  "finance.read",
  "finance.write",
  "houseAccounts.read",
  "houseAccounts.write",
  "compliance.read",
  "compliance.write",
  "checkin.scan",
  "settings.write",
  "messaging.read",
  "messaging.write",
  "messaging.bulkSend",
  "payments.chargeOnFile",
];

const STAFF_IMPLIED: Capability[] = [
  "members.read",
  "members.write",
  "groups.read",
  "groups.write",
  "committees.read",
  "committees.write",
  "events.read",
  "events.write",
  "houseAccounts.read",
  "houseAccounts.write",
  "checkin.scan",
  "messaging.read",
  "messaging.write",
];

const MEMBER_IMPLIED: Capability[] = [
  "members.read",
  "groups.read",
  "committees.read",
  "events.read",
];

const OPERATOR_IMPLIED: Capability[] = [
  ...ADMIN_IMPLIED,
  "operator.clubs",
  "operator.audit",
];

export function effectiveCapabilities(
  role: Role,
  explicit: Capability[]
): Capability[] {
  const implied =
    role === "OPERATOR"
      ? OPERATOR_IMPLIED
      : role === "ADMIN"
        ? ADMIN_IMPLIED
        : role === "STAFF"
          ? STAFF_IMPLIED
          : MEMBER_IMPLIED;
  return Array.from(new Set([...implied, ...explicit]));
}

export function hasCapability(
  role: Role,
  explicit: Capability[],
  required: Capability
): boolean {
  return effectiveCapabilities(role, explicit).includes(required);
}

export function isOperator(role: Role): boolean {
  return role === "OPERATOR";
}
