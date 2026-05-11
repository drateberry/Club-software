import * as SecureStore from "expo-secure-store";
import { config } from "./config";

const TOKEN_KEY = "club_os.access_token";

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setAccessToken(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const token = init.skipAuth ? null : await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${config.apiBase}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  const body = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  })() : null;

  if (!res.ok) {
    if (res.status === 401) {
      await setAccessToken(null);
    }
    const message =
      typeof body === "object" && body && "error_description" in body
        ? (body as { error_description?: string }).error_description ?? `HTTP ${res.status}`
        : `HTTP ${res.status}`;
    throw new ApiError(res.status, body, message);
  }

  return body as T;
}
