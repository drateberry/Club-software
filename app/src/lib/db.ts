import { PrismaClient } from "@prisma/client";
import { getTenantContext } from "./tenantContext";

/**
 * Tenant-scoped models — auto-inject clubId on reads/writes when an
 * AsyncLocalStorage tenant context is active. Models NOT in this set
 * pass through unchanged (User, Auth.js tables, Club itself, child
 * tables like Address that reach the tenant via a parent).
 */
const SCOPED_MODELS = new Set([
  "Member",
  "Group",
  "Committee",
  "Event",
  "Invoice",
  "HouseCharge",
  "Statement",
  "ComplianceCertificate",
  "Task",
  "Feedback",
  "Reminder",
  "CheckinLog",
  "Conversation",
  "OutboundOptOut",
  "SavedPaymentMethod",
  "MCPClient",
  "MCPToken",
  "Setting",
  "MediaAsset",
  "WebhookEvent",
  "AuditEvent",
]);

/** Operations that take a `where` argument we can augment. */
const WHERE_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

/** Operations that take a `data` argument we can augment on create. */
const CREATE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn"]);

type AnyArgs = Record<string, unknown>;

function ensureClubIdInData(data: unknown, clubId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((d) => ensureClubIdInData(d, clubId));
  }
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (rec.clubId !== undefined || rec.club !== undefined) return rec;
    return { ...rec, clubId };
  }
  return data;
}

function mergeWhere(where: unknown, clubId: string): unknown {
  if (!where || typeof where !== "object") return { clubId };
  const w = where as Record<string, unknown>;
  if (w.clubId !== undefined) return w; // caller already scoped
  return { ...w, clubId };
}

function applyTenantInjection<T extends AnyArgs>(
  model: string,
  operation: string,
  args: T
): T {
  if (!SCOPED_MODELS.has(model)) return args;

  const ctx = getTenantContext();
  if (!ctx || ctx.asOperator) return args; // no context or operator: pass through

  const next: AnyArgs = { ...args };

  if (WHERE_OPERATIONS.has(operation)) {
    next.where = mergeWhere(next.where, ctx.clubId);
  }

  if (CREATE_OPERATIONS.has(operation) && "data" in next) {
    next.data = ensureClubIdInData(next.data, ctx.clubId);
  }

  // upsert needs both: where stays as a unique lookup (we don't augment);
  // but the `create` branch gets clubId.
  if (operation === "upsert") {
    if (next.create) next.create = ensureClubIdInData(next.create, ctx.clubId);
  }

  return next as T;
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof makeClient> | undefined;
};

function makeClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query, model, operation }) {
          const augmented = applyTenantInjection(model, operation, args as AnyArgs);

          // Mirror the tenant context to a Postgres session GUC so RLS
          // policies (prisma/sql/enable-rls.sql) enforce isolation
          // independently of the app layer. Only runs when RLS is
          // actually enabled (env flag) — most deployments today are
          // single-tenant per Postgres and don't need this overhead.
          const ctx = getTenantContext();
          if (ctx && process.env.CLUBOS_RLS_ENABLED === "1") {
            const value = ctx.asOperator ? "*" : ctx.clubId;
            try {
              await base.$executeRawUnsafe(
                "SELECT set_config('app.club_id', $1, true)",
                value
              );
            } catch {
              /* GUC set failures shouldn't break the query */
            }
          }

          return query(augmented);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
