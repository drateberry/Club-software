import type { z } from "zod";
import type { UserRole } from "@prisma/client";
import type { Capability } from "@/lib/capabilities";

export type ToolContext = {
  user: {
    id: string;
    email: string;
    role: UserRole;
    memberId: string | null;
    capabilities: Capability[];
  };
  scopes: Capability[];
};

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  structuredContent?: unknown;
};

export interface Tool<I = unknown> {
  name: string;
  title?: string;
  description: string;
  inputSchema: z.ZodType<I>;
  /**
   * Capabilities the user must have AND the token must have scoped.
   * When the user is a MEMBER, the tool implementation must additionally
   * scope to ctx.user.memberId.
   */
  required: Capability[];
  handler(input: I, ctx: ToolContext): Promise<ToolResult>;
}

export function makeTool<I>(t: Tool<I>): Tool<I> {
  return t;
}

export function textResult(text: string, structured?: unknown): ToolResult {
  return {
    content: [{ type: "text", text }],
    structuredContent: structured,
  };
}

export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}
