import { z } from "zod";
import { zodToJsonSchema } from "@/lib/zod-to-json-schema";
import type { Capability } from "@/lib/capabilities";

type RouteSpec = {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  summary: string;
  description?: string;
  scopes: Capability[];
  query?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  pathParams?: string[];
  /** A JSON-schema fragment describing the success response shape. */
  responseSchema?: Record<string, unknown>;
  tags: string[];
};

/**
 * Hand-rolled spec for /api/v1/* mirroring the actual routes. We trade a bit
 * of duplication (route handlers reference the same Zod schemas) for a
 * single source of truth that's easy to read and review.
 */
function paginated(itemRef: Record<string, unknown>) {
  return {
    type: "object",
    properties: {
      data: { type: "array", items: itemRef },
      nextCursor: { type: "string", nullable: true },
    },
    required: ["data"],
  };
}

const memberShape: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    email: { type: "string", format: "email", nullable: true },
    phone: { type: "string", nullable: true },
    memberNumber: { type: "string", nullable: true },
    membershipClass: { type: "string", nullable: true },
    membershipStatus: {
      type: "string",
      enum: ["ACTIVE", "SUSPENDED", "RESIGNED", "DECEASED"],
    },
    joinDate: { type: "string", format: "date", nullable: true },
    twilioOptedOut: { type: "boolean" },
  },
};

const invoiceShape: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "string" },
    number: { type: "string" },
    status: { type: "string", enum: ["DRAFT", "SENT", "PAID", "VOID"] },
    kind: { type: "string" },
    currency: { type: "string" },
    totalCents: { type: "integer" },
    dueDate: { type: "string", format: "date", nullable: true },
    paidAt: { type: "string", format: "date-time", nullable: true },
  },
};

const eventShape: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    startAt: { type: "string", format: "date-time" },
    endAt: { type: "string", format: "date-time" },
    venue: { type: "string", nullable: true },
    capacity: { type: "integer", nullable: true },
    isTicketed: { type: "boolean" },
    memberPriceCents: { type: "integer" },
  },
};

const SPECS: RouteSpec[] = [
  {
    method: "get",
    path: "/api/v1/me",
    summary: "Current user",
    description: "Returns the authed user, role, capabilities, granted token scopes, linked Member, and club config.",
    scopes: [],
    tags: ["identity"],
    responseSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        email: { type: "string", format: "email" },
        name: { type: "string", nullable: true },
        role: { type: "string", enum: ["ADMIN", "STAFF", "MEMBER"] },
        capabilities: { type: "array", items: { type: "string" } },
        tokenScopes: { type: "array", items: { type: "string" } },
        passToken: { type: "string", nullable: true },
        member: memberShape,
        clubName: { type: "string" },
        currency: { type: "string" },
        locale: { type: "string" },
        timezone: { type: "string" },
      },
    },
  },
  {
    method: "get",
    path: "/api/v1/members",
    summary: "List members",
    description: "Search + paging via cursor. Member-scoped tokens return only themselves.",
    scopes: ["members.read"],
    tags: ["members"],
    query: z.object({
      search: z.string().max(100).optional(),
      membershipStatus: z.enum(["ACTIVE", "SUSPENDED", "RESIGNED", "DECEASED"]).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      cursor: z.string().optional(),
    }),
    responseSchema: paginated(memberShape),
  },
  {
    method: "get",
    path: "/api/v1/members/{id}",
    summary: "Get member by ID",
    scopes: ["members.read"],
    pathParams: ["id"],
    tags: ["members"],
    responseSchema: memberShape,
  },
  {
    method: "get",
    path: "/api/v1/invoices",
    summary: "List invoices",
    scopes: ["finance.read"],
    tags: ["invoices"],
    query: z.object({
      status: z.enum(["DRAFT", "SENT", "PAID", "VOID"]).optional(),
      memberId: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }),
    responseSchema: { type: "object", properties: { data: { type: "array", items: invoiceShape } } },
  },
  {
    method: "get",
    path: "/api/v1/invoices/{id}",
    summary: "Get invoice with line items, installments, and payment history",
    scopes: ["finance.read"],
    pathParams: ["id"],
    tags: ["invoices"],
    responseSchema: invoiceShape,
  },
  {
    method: "post",
    path: "/api/v1/invoices/{id}/charge",
    summary: "Charge the default card on file",
    description: "Charges the next unpaid installment (or full invoice if no plan). Member tokens forbidden.",
    scopes: ["payments.chargeOnFile"],
    pathParams: ["id"],
    tags: ["invoices"],
    responseSchema: {
      type: "object",
      properties: {
        paymentIntentId: { type: "string" },
        status: { type: "string" },
        amountCents: { type: "integer" },
      },
    },
  },
  {
    method: "get",
    path: "/api/v1/events",
    summary: "List upcoming events",
    scopes: ["events.read"],
    tags: ["events"],
    query: z.object({
      upcoming: z.boolean().default(true),
      limit: z.number().int().min(1).max(200).default(50),
    }),
    responseSchema: { type: "object", properties: { data: { type: "array", items: eventShape } } },
  },
  {
    method: "post",
    path: "/api/v1/events/{id}/rsvp",
    summary: "RSVP to an event for the authed member",
    scopes: ["events.read"],
    pathParams: ["id"],
    tags: ["events"],
    body: z.object({ status: z.enum(["GOING", "MAYBE", "DECLINED"]).default("GOING") }),
  },
  {
    method: "post",
    path: "/api/v1/events/{id}/ticket",
    summary: "Start a Stripe Checkout ticket purchase",
    description: "Returns a checkoutUrl the client should open in a browser.",
    scopes: ["events.read"],
    pathParams: ["id"],
    tags: ["events"],
    responseSchema: {
      type: "object",
      properties: { checkoutUrl: { type: "string", format: "uri" }, providerPaymentId: { type: "string" } },
    },
  },
  {
    method: "get",
    path: "/api/v1/house-accounts/balance",
    summary: "Unbilled house-account balance for a member",
    scopes: ["houseAccounts.read"],
    tags: ["house-accounts"],
    query: z.object({ memberId: z.string().optional() }),
    responseSchema: {
      type: "object",
      properties: {
        memberId: { type: "string" },
        totalCents: { type: "integer" },
        charges: { type: "array", items: { type: "object" } },
      },
    },
  },
  {
    method: "post",
    path: "/api/v1/house-accounts/charges",
    summary: "Post a charge to a member's house account",
    scopes: ["houseAccounts.write"],
    tags: ["house-accounts"],
    body: z.object({
      memberId: z.string().min(1),
      category: z.string(),
      amountCents: z.number().int().min(1).max(10_000_000),
      occurredOn: z.string().optional(),
      memo: z.string().max(500).optional(),
    }),
  },
  {
    method: "get",
    path: "/api/v1/messaging/conversations",
    summary: "List SMS conversations",
    scopes: ["messaging.read"],
    tags: ["messaging"],
    query: z.object({
      unreadOnly: z.boolean().default(false),
      limit: z.number().int().min(1).max(200).default(50),
    }),
  },
  {
    method: "get",
    path: "/api/v1/messaging/conversations/{id}/messages",
    summary: "Get full message thread",
    scopes: ["messaging.read"],
    pathParams: ["id"],
    tags: ["messaging"],
  },
  {
    method: "post",
    path: "/api/v1/messaging/conversations/{id}/messages",
    summary: "Send an SMS reply",
    scopes: ["messaging.write"],
    pathParams: ["id"],
    tags: ["messaging"],
    body: z.object({ body: z.string().min(1).max(1600) }),
  },
  {
    method: "get",
    path: "/api/v1/checkin",
    summary: "Recent check-ins",
    scopes: ["checkin.scan"],
    tags: ["checkin"],
    query: z.object({
      sinceHours: z.number().int().min(1).max(168).default(24),
      limit: z.number().int().min(1).max(200).default(50),
    }),
  },
  {
    method: "post",
    path: "/api/v1/checkin",
    summary: "Log a member check-in",
    description: "Resolve member via passToken (QR scan) or memberId (manual).",
    scopes: ["checkin.scan"],
    tags: ["checkin"],
    body: z.object({
      passToken: z.string().optional(),
      memberId: z.string().optional(),
      note: z.string().max(200).optional(),
    }),
  },
  {
    method: "get",
    path: "/api/v1/payment-methods",
    summary: "List a member's saved cards / ACH",
    scopes: ["finance.read"],
    tags: ["payment-methods"],
    query: z.object({ memberId: z.string().optional() }),
  },
  {
    method: "post",
    path: "/api/v1/payment-methods/setup-intent",
    summary: "Stripe SetupIntent client secret for adding a payment method",
    scopes: ["finance.read"],
    tags: ["payment-methods"],
    body: z.object({ memberId: z.string().optional() }),
    responseSchema: {
      type: "object",
      properties: {
        clientSecret: { type: "string" },
        publishableKey: { type: "string", nullable: true },
      },
    },
  },
  {
    method: "post",
    path: "/api/v1/payment-methods/portal",
    summary: "Open the Stripe Customer Portal",
    scopes: ["finance.read"],
    tags: ["payment-methods"],
    body: z.object({
      memberId: z.string().optional(),
      returnUrl: z.string().url().optional(),
    }),
    responseSchema: { type: "object", properties: { url: { type: "string", format: "uri" } } },
  },
];

function paramsForPath(path: string, route: RouteSpec) {
  const params: Array<Record<string, unknown>> = [];
  for (const name of route.pathParams ?? []) {
    params.push({
      name,
      in: "path",
      required: true,
      schema: { type: "string" },
    });
  }
  if (route.query) {
    const qs = zodToJsonSchema(route.query) as { properties?: Record<string, unknown>; required?: string[] };
    for (const [name, schema] of Object.entries(qs.properties ?? {})) {
      params.push({
        name,
        in: "query",
        required: (qs.required ?? []).includes(name),
        schema,
      });
    }
  }
  return params;
}

export function buildOpenApiSpec(baseUrl: string): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of SPECS) {
    paths[route.path] ??= {};
    const op: Record<string, unknown> = {
      tags: route.tags,
      summary: route.summary,
      description: route.description,
      security: route.scopes.length ? [{ bearerAuth: route.scopes }] : [{ bearerAuth: [] }],
      parameters: paramsForPath(route.path, route),
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": {
              schema: route.responseSchema ?? { type: "object" },
            },
          },
        },
        "401": { description: "Unauthorized" },
        "403": { description: "Forbidden — missing required scope" },
        "404": { description: "Not found" },
        "429": { description: "Rate limited" },
      },
    };
    if (route.body) {
      op.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: zodToJsonSchema(route.body),
          },
        },
      };
    }
    paths[route.path][route.method] = op;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Club OS API",
      version: "1.0.0",
      description:
        "REST surface over the Club OS application. Bearer auth via the MCP OAuth 2.1 + PKCE flow at /.well-known/oauth-authorization-server.",
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: `${baseUrl}/oauth/authorize`,
              tokenUrl: `${baseUrl}/api/mcp/oauth/token`,
              scopes: {
                "members.read": "Read member data",
                "members.write": "Create / update / delete members",
                "groups.read": "Read groups",
                "groups.write": "Manage groups",
                "committees.read": "Read committees",
                "committees.write": "Manage committees",
                "events.read": "Read events + RSVP for self",
                "events.write": "Manage events",
                "finance.read": "Read invoices and payment methods",
                "finance.write": "Create / send / void invoices",
                "houseAccounts.read": "Read house account charges",
                "houseAccounts.write": "Post / delete charges, run statements",
                "compliance.read": "Read compliance certificates",
                "compliance.write": "Manage compliance certificates",
                "checkin.scan": "Scan member passes / log check-ins",
                "messaging.read": "Read SMS conversations",
                "messaging.write": "Send SMS",
                "messaging.bulkSend": "Bulk SMS send",
                "payments.chargeOnFile": "Charge cards on file off-session",
                "settings.write": "Update settings",
              },
            },
          },
        },
      },
    },
    paths,
  };
}
