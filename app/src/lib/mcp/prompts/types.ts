import type { ToolContext } from "../types";
import type { Capability } from "@/lib/capabilities";

export type PromptArgument = {
  name: string;
  description?: string;
  required?: boolean;
};

export type PromptMessage = {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
};

export type Prompt = {
  name: string;
  title?: string;
  description: string;
  arguments?: PromptArgument[];
  required: Capability[];
  build(args: Record<string, string>, ctx: ToolContext): Promise<{
    description?: string;
    messages: PromptMessage[];
  }>;
};
