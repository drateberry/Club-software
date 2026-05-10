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
  | "settings.write";

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
];

const MEMBER_IMPLIED: Capability[] = [
  "members.read",
  "groups.read",
  "committees.read",
  "events.read",
];

export function effectiveCapabilities(
  role: "ADMIN" | "STAFF" | "MEMBER",
  explicit: Capability[]
): Capability[] {
  const implied =
    role === "ADMIN" ? ADMIN_IMPLIED : role === "STAFF" ? STAFF_IMPLIED : MEMBER_IMPLIED;
  return Array.from(new Set([...implied, ...explicit]));
}

export function hasCapability(
  role: "ADMIN" | "STAFF" | "MEMBER",
  explicit: Capability[],
  required: Capability
): boolean {
  return effectiveCapabilities(role, explicit).includes(required);
}
