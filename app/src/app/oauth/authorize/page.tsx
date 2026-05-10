import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { effectiveCapabilities, type Capability } from "@/lib/capabilities";
import { issueAuthorizationCode } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

const ALL_SCOPES: Capability[] = [
  "members.read",
  "members.write",
  "groups.read",
  "committees.read",
  "events.read",
  "events.write",
  "finance.read",
  "finance.write",
  "houseAccounts.read",
  "houseAccounts.write",
  "compliance.read",
  "checkin.scan",
  "messaging.read",
  "messaging.write",
  "messaging.bulkSend",
  "payments.chargeOnFile",
];

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{
    response_type?: string;
    client_id?: string;
    redirect_uri?: string;
    scope?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/oauth/authorize?" + new URLSearchParams(params as Record<string, string>).toString())}`);
  }

  const errorRedirect = (description: string) => {
    if (params.redirect_uri) {
      const url = new URL(params.redirect_uri);
      url.searchParams.set("error", "invalid_request");
      url.searchParams.set("error_description", description);
      if (params.state) url.searchParams.set("state", params.state);
      redirect(url.toString());
    }
    redirect(`/oauth/authorize/error?msg=${encodeURIComponent(description)}`);
  };

  if (params.response_type !== "code") {
    errorRedirect("response_type must be 'code'");
  }
  if (!params.client_id) errorRedirect("Missing client_id");
  if (!params.redirect_uri) errorRedirect("Missing redirect_uri");
  if (params.code_challenge_method && params.code_challenge_method !== "S256") {
    errorRedirect("code_challenge_method must be S256");
  }
  if (!params.code_challenge) errorRedirect("Missing code_challenge (PKCE required)");

  const client = await prisma.mCPClient.findUnique({ where: { clientId: params.client_id! } });
  if (!client) errorRedirect("Unknown client_id");

  const allowedRedirects = (client!.redirectUris as string[]) ?? [];
  if (!allowedRedirects.includes(params.redirect_uri!)) {
    errorRedirect("redirect_uri not registered for this client");
  }

  const requestedScopes = (params.scope ?? "")
    .split(" ")
    .filter(Boolean) as Capability[];

  const userCaps = (session!.user.capabilities ?? []) as Capability[];
  const userEffective = effectiveCapabilities(session!.user.role, userCaps);
  const grantableScopes = requestedScopes.filter((s) => userEffective.includes(s));
  const deniedScopes = requestedScopes.filter((s) => !userEffective.includes(s));

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Authorize {client!.name}</h1>
        <p className="text-sm text-gray-600">
          {client!.name} is requesting access to your {process.env.CLUB_NAME ?? "Club OS"} account.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 text-sm">
          Signed in as <strong>{session!.user.email}</strong>
        </div>
        <h2 className="mb-2 text-sm font-semibold">Permissions requested</h2>
        {grantableScopes.length === 0 ? (
          <p className="text-sm text-gray-500">No grantable permissions.</p>
        ) : (
          <form action={issueAuthorizationCode} className="space-y-3">
            <input type="hidden" name="client_id" value={params.client_id!} />
            <input type="hidden" name="redirect_uri" value={params.redirect_uri!} />
            <input type="hidden" name="code_challenge" value={params.code_challenge!} />
            <input type="hidden" name="state" value={params.state ?? ""} />
            <input type="hidden" name="all_scopes" value={ALL_SCOPES.join(" ")} />
            <ul className="space-y-2">
              {grantableScopes.map((scope) => (
                <li key={scope} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="scope"
                    value={scope}
                    defaultChecked
                    className="mt-1"
                  />
                  <span>
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">{scope}</code>
                  </span>
                </li>
              ))}
            </ul>
            {deniedScopes.length > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                These requested scopes are not available to your account and were skipped:{" "}
                {deniedScopes.join(", ")}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <a
                href={(() => {
                  const url = new URL(params.redirect_uri!);
                  url.searchParams.set("error", "access_denied");
                  if (params.state) url.searchParams.set("state", params.state);
                  return url.toString();
                })()}
                className="rounded border border-gray-300 px-4 py-2 text-sm"
              >
                Deny
              </a>
              <SubmitButton pendingLabel="Authorizing…">Approve</SubmitButton>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
