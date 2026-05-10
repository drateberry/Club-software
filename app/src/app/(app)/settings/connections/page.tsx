import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyButton } from "@/components/CopyButton";
import { formatDateTime } from "@/lib/format";
import { effectiveCapabilities, type Capability } from "@/lib/capabilities";
import { revokeToken } from "./actions";
import { SettingsTabs } from "../tabs";

const SCOPE_GROUPS: Array<{ label: string; scopes: Capability[]; defaultRoles: Array<"ADMIN" | "STAFF" | "MEMBER"> }> = [
  {
    label: "Read your own profile, invoices, balance",
    scopes: ["members.read", "finance.read", "houseAccounts.read", "events.read"],
    defaultRoles: ["MEMBER", "STAFF", "ADMIN"],
  },
  {
    label: "RSVP to events on your behalf",
    scopes: ["events.read"],
    defaultRoles: ["MEMBER", "STAFF", "ADMIN"],
  },
  {
    label: "Send SMS to members",
    scopes: ["messaging.read", "messaging.write"],
    defaultRoles: ["STAFF", "ADMIN"],
  },
  {
    label: "Create invoices and post house charges",
    scopes: ["finance.read", "finance.write", "houseAccounts.write"],
    defaultRoles: ["STAFF", "ADMIN"],
  },
  {
    label: "Charge a member's card on file",
    scopes: ["payments.chargeOnFile", "finance.read"],
    defaultRoles: ["ADMIN"],
  },
];

export default async function ConnectionsPage() {
  const session = await requireSession();
  const userCaps = (session.user.capabilities ?? []) as Capability[];
  const userEffective = effectiveCapabilities(session.user.role, userCaps);
  const baseUrl = process.env.CLUB_PUBLIC_URL ?? "http://localhost:3000";
  const discoveryUrl = `${baseUrl}/.well-known/oauth-authorization-server`;
  const mcpUrl = `${baseUrl}/api/mcp`;

  const tokens = await prisma.mCPToken.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    include: { mcpClient: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsTabs active="connections" />

      <section className="max-w-3xl space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Connect a new AI client</h2>
          <p className="mt-1 text-xs text-gray-500">
            {process.env.CLUB_NAME ?? "Club OS"} exposes an MCP server that AI
            clients (Claude Desktop, Cursor, ChatGPT desktop apps, custom
            agents) can use to read and act on club data on your behalf.
            Connecting opens a browser tab where you can review and approve
            the requested permissions.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              MCP server URL
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-gray-50 px-3 py-2 text-xs">
                {mcpUrl}
              </code>
              <CopyButton value={mcpUrl} />
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              OAuth discovery URL
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-gray-50 px-3 py-2 text-xs">
                {discoveryUrl}
              </code>
              <CopyButton value={discoveryUrl} />
            </div>
          </div>
        </div>

        <details className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-gray-700">
            How to add this to Claude Desktop
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-gray-600">
            <li>Open Claude Desktop → Settings → Developer → Edit Config.</li>
            <li>
              Add a new entry to <code>mcpServers</code> with{" "}
              <code>type: &quot;url&quot;</code> and the MCP server URL above.
              Claude will discover OAuth automatically and prompt you to
              approve in your browser.
            </li>
            <li>
              On approve, Claude gets a scoped bearer token tied to your
              account; revoke it any time below.
            </li>
          </ol>
        </details>

        <details className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-gray-700">
            How to add this to Cursor / a custom OAuth client
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-gray-600">
            <li>Point your client at the discovery URL above.</li>
            <li>
              The client should self-register via the{" "}
              <code>registration_endpoint</code> (RFC 7591), then run the
              authorization-code + PKCE flow.
            </li>
            <li>
              After approval, the client receives an access token and uses
              it as <code>Authorization: Bearer …</code> on{" "}
              <code>POST /api/mcp</code> JSON-RPC calls.
            </li>
          </ol>
        </details>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Permissions an AI client can request
          </div>
          <ul className="space-y-1 text-xs text-gray-600">
            {SCOPE_GROUPS.filter((g) =>
              g.scopes.some((s) => userEffective.includes(s))
            ).map((group, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gray-300" />
                <span>
                  <span className="text-gray-800">{group.label}</span>
                  <span className="ml-1 text-gray-400">
                    ({group.scopes.filter((s) => userEffective.includes(s)).join(", ")})
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">
            You can deselect any individual scope on the consent screen.
            Member-scoped tokens automatically read/write only your own data.
          </p>
        </div>
      </section>

      <section className="max-w-3xl space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Active connections</h2>

        {tokens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            No active MCP connections. Add one using the URL above.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {tokens.map((t) => {
              const revoke = revokeToken.bind(null, t.id);
              const scopes = (t.scopes as string[]) ?? [];
              return (
                <li key={t.id} className="space-y-2 p-4 text-sm">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="font-medium">{t.mcpClient.name}</div>
                      <div className="text-xs text-gray-500">
                        Added {formatDateTime(t.createdAt)}
                        {t.lastUsedAt && ` · last used ${formatDateTime(t.lastUsedAt)}`}
                        {` · expires ${formatDateTime(t.expiresAt)}`}
                      </div>
                    </div>
                    <form action={revoke}>
                      <ConfirmButton
                        message={`Revoke this token for ${t.mcpClient.name}? The AI client will lose access immediately.`}
                        confirmLabel="Revoke"
                        pendingLabel="Revoking…"
                      >
                        Revoke
                      </ConfirmButton>
                    </form>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {scopes.map((s) => (
                      <code
                        key={s}
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px]"
                      >
                        {s}
                      </code>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
