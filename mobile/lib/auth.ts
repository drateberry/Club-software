import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { api, setAccessToken } from "./api";
import { config } from "./config";

const CLIENT_ID_KEY = "club_os.client_id";

const SCOPES = [
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
  "payments.chargeOnFile",
];

export type DiscoveryDoc = {
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint?: string;
  registration_endpoint?: string;
};

export async function fetchDiscovery(): Promise<DiscoveryDoc> {
  return api<DiscoveryDoc>("/.well-known/oauth-authorization-server", {
    skipAuth: true,
  });
}

export async function getOrRegisterClientId(
  discovery: DiscoveryDoc
): Promise<string> {
  const cached = await SecureStore.getItemAsync(CLIENT_ID_KEY);
  if (cached) return cached;

  const envClient = config.mcpClientId;
  if (envClient) {
    await SecureStore.setItemAsync(CLIENT_ID_KEY, envClient);
    return envClient;
  }

  if (!discovery.registration_endpoint) {
    throw new Error("No registration_endpoint and no EXPO_PUBLIC_MCP_CLIENT_ID set");
  }

  const res = await fetch(discovery.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Club OS Mobile",
      redirect_uris: [config.redirectUri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!res.ok) {
    throw new Error(`DCR failed: ${res.status}`);
  }
  const reg = (await res.json()) as { client_id: string };
  await SecureStore.setItemAsync(CLIENT_ID_KEY, reg.client_id);
  return reg.client_id;
}

/**
 * Drive the full OAuth 2.1 authorization code + PKCE flow. Returns once a
 * bearer token has been persisted in secure storage (or throws on cancel).
 */
export async function startSignIn(): Promise<void> {
  const discovery = await fetchDiscovery();
  const clientId = await getOrRegisterClientId(discovery);

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri: config.redirectUri,
    scopes: SCOPES,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync({
    authorizationEndpoint: discovery.authorization_endpoint,
  });

  if (result.type !== "success" || !result.params.code) {
    throw new Error(
      result.type === "error"
        ? result.error?.message ?? "Sign-in failed"
        : "Sign-in cancelled"
    );
  }

  const tokenRes = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: result.params.code,
      redirect_uri: config.redirectUri,
      client_id: clientId,
      code_verifier: request.codeVerifier ?? "",
    }).toString(),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Token exchange failed: ${text}`);
  }
  const token = (await tokenRes.json()) as { access_token: string };
  await setAccessToken(token.access_token);
}

export async function signOut(): Promise<void> {
  await setAccessToken(null);
}
