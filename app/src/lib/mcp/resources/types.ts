import type { ToolContext } from "../types";
import type { Capability } from "@/lib/capabilities";

export type ResourceContent = {
  mimeType: string;
  text: string;
};

export type Resource = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  required: Capability[];
  read(ctx: ToolContext): Promise<ResourceContent>;
};

export type ResourceTemplate = {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
  required: Capability[];
  /** Returns the params extracted from a URI, or null if it doesn't match. */
  match(uri: string): Record<string, string> | null;
  read(params: Record<string, string>, ctx: ToolContext): Promise<ResourceContent>;
};

/**
 * Tiny URI-template matcher: matches `{key}` placeholders. Whole-segment
 * placeholders only — no escaping, no operators.
 */
export function templateMatcher(template: string) {
  const keys: string[] = [];
  const pattern = template.replace(/\{(\w+)\}/g, (_, key: string) => {
    keys.push(key);
    return "([^/]+)";
  });
  const regex = new RegExp(`^${pattern}$`);
  return (uri: string): Record<string, string> | null => {
    const m = regex.exec(uri);
    if (!m) return null;
    const params: Record<string, string> = {};
    keys.forEach((k, i) => {
      params[k] = decodeURIComponent(m[i + 1]);
    });
    return params;
  };
}

export function jsonResource(text: unknown): ResourceContent {
  return {
    mimeType: "application/json",
    text: JSON.stringify(text, null, 2),
  };
}

export function textResource(text: string): ResourceContent {
  return { mimeType: "text/plain", text };
}
