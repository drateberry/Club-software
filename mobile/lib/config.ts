import Constants from "expo-constants";

const fromExtra =
  (Constants.expoConfig?.extra as Record<string, string> | undefined) ?? {};

export const config = {
  apiBase:
    process.env.EXPO_PUBLIC_CLUB_OS_API_BASE ??
    fromExtra.apiBase ??
    "http://localhost:3000",
  mcpClientId: process.env.EXPO_PUBLIC_MCP_CLIENT_ID ?? null,
  scheme: "clubos",
  redirectUri: "clubos://oauth/callback",
};
