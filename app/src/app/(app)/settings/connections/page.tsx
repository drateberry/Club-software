import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guards";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatDateTime } from "@/lib/format";
import { revokeToken } from "./actions";
import { SettingsTabs } from "../tabs";

export default async function ConnectionsPage() {
  const session = await requireSession();

  const tokens = await prisma.mCPToken.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    include: { mcpClient: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsTabs active="connections" />

      <section className="max-w-3xl space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Connected AI clients</h2>
        <p className="text-xs text-gray-500">
          AI clients (Claude Desktop, ChatGPT, etc.) that you&apos;ve authorized
          to access {process.env.CLUB_NAME ?? "Club OS"} on your behalf via MCP.
          Revoke any you no longer recognize.
        </p>

        {tokens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            No active MCP connections.
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

      <section className="max-w-3xl rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <h2 className="text-sm font-semibold text-gray-700">Connect an AI client</h2>
        <p className="mt-2">
          The MCP server lives at <code className="rounded bg-gray-100 px-1">/api/mcp</code>.
          Discovery metadata is at{" "}
          <code className="rounded bg-gray-100 px-1">/.well-known/oauth-authorization-server</code>.
        </p>
        <p className="mt-2">
          Most AI clients support OAuth 2.1 with Dynamic Client Registration —
          point them at the discovery URL and follow the in-browser consent flow.
        </p>
      </section>
    </div>
  );
}
