import { z } from "zod";
import type { ZodObject, ZodRawShape, ZodTypeAny } from "zod";
import { allTools, findTool } from "./registry";
import { hasScope } from "./auth";
import type { ToolContext, ToolResult } from "./types";
import { logAudit } from "@/lib/audit";

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse =
  | {
      jsonrpc: "2.0";
      id: string | number | null;
      result: unknown;
    }
  | {
      jsonrpc: "2.0";
      id: string | number | null;
      error: { code: number; message: string; data?: unknown };
    };

const PROTOCOL_VERSION = "2025-06-18";

const SERVER_INFO = {
  name: "club-os",
  version: "1.0.0",
};

function zodToJsonSchema(schema: ZodTypeAny): unknown {
  const def = (schema as { _def?: { typeName?: string } })._def;
  if (!def) return { type: "object" };
  switch (def.typeName) {
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "string", enum: (def as { values: string[] }).values };
    case "ZodOptional":
    case "ZodNullable":
      return zodToJsonSchema((def as { innerType: ZodTypeAny }).innerType);
    case "ZodDefault":
      return zodToJsonSchema((def as { innerType: ZodTypeAny }).innerType);
    case "ZodArray":
      return {
        type: "array",
        items: zodToJsonSchema((def as { type: ZodTypeAny }).type),
      };
    case "ZodObject": {
      const shape = (schema as ZodObject<ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as ZodTypeAny);
        const field = value as ZodTypeAny;
        const fdef = (field as { _def: { typeName?: string } })._def;
        if (fdef.typeName !== "ZodOptional" && fdef.typeName !== "ZodDefault") {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        ...(required.length ? { required } : {}),
      };
    }
    default:
      return { type: "object" };
  }
}

export async function handleRequest(
  request: JsonRpcRequest,
  ctx: ToolContext
): Promise<JsonRpcResponse> {
  const id = request.id ?? null;
  try {
    switch (request.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
          },
        };

      case "ping":
        return { jsonrpc: "2.0", id, result: {} };

      case "tools/list": {
        const tools = allTools()
          .filter((t) => t.required.every((cap) => ctx.scopes.includes(cap)))
          .map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            inputSchema: zodToJsonSchema(t.inputSchema),
          }));
        return { jsonrpc: "2.0", id, result: { tools } };
      }

      case "tools/call": {
        const { name, arguments: args = {} } = (request.params ?? {}) as {
          name?: string;
          arguments?: Record<string, unknown>;
        };
        if (!name) {
          return errorResp(id, -32602, "Missing tool name");
        }
        const tool = findTool(name);
        if (!tool) return errorResp(id, -32601, `Tool not found: ${name}`);

        if (!hasScope(ctx, tool.required)) {
          return errorResp(
            id,
            -32603,
            `Forbidden: tool ${name} requires scopes ${tool.required.join(", ")}`
          );
        }

        let parsedInput: unknown;
        try {
          parsedInput = tool.inputSchema.parse(args);
        } catch (err) {
          if (err instanceof z.ZodError) {
            return errorResp(id, -32602, `Invalid input: ${err.message}`);
          }
          throw err;
        }

        let result: ToolResult;
        try {
          result = await tool.handler(parsedInput, ctx);
        } catch (err) {
          const message = (err as Error).message;
          await logAudit(ctx.user.id, `mcp.${name}.error`, "User", ctx.user.id, {
            error: message,
          });
          return errorResp(id, -32000, `Tool execution failed: ${message}`);
        }

        await logAudit(ctx.user.id, `mcp.${name}`, "User", ctx.user.id, {
          isError: result.isError ?? false,
        });

        return { jsonrpc: "2.0", id, result };
      }

      default:
        return errorResp(id, -32601, `Method not found: ${request.method}`);
    }
  } catch (err) {
    return errorResp(id, -32603, `Internal error: ${(err as Error).message}`);
  }
}

function errorResp(
  id: string | number | null,
  code: number,
  message: string
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
