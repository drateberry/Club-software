import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const base = process.env.CLUB_PUBLIC_URL ?? new URL(req.url).origin;
  return NextResponse.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/mcp/oauth/token`,
    revocation_endpoint: `${base}/api/mcp/oauth/revoke`,
    registration_endpoint: `${base}/api/mcp/oauth/register`,
    scopes_supported: [
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
      "messaging.read",
      "messaging.write",
      "messaging.bulkSend",
      "payments.chargeOnFile",
    ],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
}
