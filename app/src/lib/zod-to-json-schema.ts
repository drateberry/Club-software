import type { ZodObject, ZodRawShape, ZodTypeAny } from "zod";

type JsonSchema = {
  type?: string;
  enum?: unknown[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  default?: unknown;
  nullable?: boolean;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
};

/**
 * Convert a Zod schema to a JSON Schema fragment usable in OpenAPI 3.1 or
 * MCP tool input definitions. Conservative — handles the subset of Zod
 * actually used in this codebase. Unknown types fall back to `object`.
 */
export function zodToJsonSchema(schema: ZodTypeAny): JsonSchema {
  const def = (schema as { _def?: { typeName?: string } })._def;
  if (!def) return { type: "object" };

  switch (def.typeName) {
    case "ZodString": {
      const checks = (def as { checks?: Array<{ kind: string; value?: unknown }> })
        .checks ?? [];
      const schema: JsonSchema = { type: "string" };
      for (const check of checks) {
        if (check.kind === "email") schema.format = "email";
        if (check.kind === "url") schema.format = "uri";
        if (check.kind === "uuid") schema.format = "uuid";
        if (check.kind === "min") schema.minLength = check.value as number;
        if (check.kind === "max") schema.maxLength = check.value as number;
      }
      return schema;
    }
    case "ZodNumber": {
      const checks = (def as { checks?: Array<{ kind: string; value?: unknown }> })
        .checks ?? [];
      const schema: JsonSchema = { type: "number" };
      for (const check of checks) {
        if (check.kind === "int") schema.type = "integer";
        if (check.kind === "min") schema.minimum = check.value as number;
        if (check.kind === "max") schema.maximum = check.value as number;
      }
      return schema;
    }
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "string", enum: (def as { values: string[] }).values };
    case "ZodNativeEnum":
      return {
        type: "string",
        enum: Object.values((def as { values: Record<string, unknown> }).values),
      };
    case "ZodLiteral":
      return { type: typeof (def as { value: unknown }).value as string, enum: [(def as { value: unknown }).value] };
    case "ZodOptional": {
      const inner = zodToJsonSchema((def as { innerType: ZodTypeAny }).innerType);
      return inner;
    }
    case "ZodNullable": {
      const inner = zodToJsonSchema((def as { innerType: ZodTypeAny }).innerType);
      inner.nullable = true;
      return inner;
    }
    case "ZodDefault": {
      const inner = zodToJsonSchema((def as { innerType: ZodTypeAny }).innerType);
      inner.default = (def as { defaultValue: () => unknown }).defaultValue?.();
      return inner;
    }
    case "ZodUnion": {
      const options = (def as { options: ZodTypeAny[] }).options ?? [];
      return { oneOf: options.map(zodToJsonSchema) };
    }
    case "ZodArray":
      return {
        type: "array",
        items: zodToJsonSchema((def as { type: ZodTypeAny }).type),
      };
    case "ZodObject": {
      const shape = (schema as ZodObject<ZodRawShape>).shape;
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as ZodTypeAny);
        const fdef = ((value as ZodTypeAny) as { _def: { typeName?: string } })._def;
        if (
          fdef.typeName !== "ZodOptional" &&
          fdef.typeName !== "ZodDefault" &&
          fdef.typeName !== "ZodNullable"
        ) {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        ...(required.length ? { required } : {}),
      };
    }
    case "ZodEffects":
      return zodToJsonSchema((def as { schema: ZodTypeAny }).schema);
    case "ZodCoerce":
      return zodToJsonSchema((def as { schema: ZodTypeAny }).schema);
    default:
      return { type: "object" };
  }
}
