import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";

export const DEFAULT_CLUB_ID = "default";
export const DEFAULT_CLUB_SLUG = "default";

export type TenantContext = {
  clubId: string;
  slug: string;
  name: string;
};

const slugFromHost = (host: string | null): string | null => {
  if (!host) return null;
  const bare = host.split(":")[0]; // strip port
  // pinehurst.club-os.app → "pinehurst"
  // localhost            → null (no subdomain)
  // 192.168.x.x          → null (raw IP)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(bare)) return null;
  const parts = bare.split(".");
  if (parts.length < 3) return null;
  const candidate = parts[0];
  // Common reserved subdomains aren't tenants:
  if (["www", "api", "auth"].includes(candidate)) return null;
  return candidate;
};

/**
 * Resolve the tenant club for the current request.
 *  - Subdomain (browser): `<slug>.club-os.app` → slug
 *  - Header (API + mobile): `X-Club-Slug: <slug>`
 *  - Env override (single-tenant deploys): `CLUB_SLUG` env var
 *  - Default: the "default" club (matches every single-tenant deploy
 *    seeded today)
 *
 * Falls back to the default club when no other source resolves so this
 * is zero-risk against the existing single-tenant fleet.
 */
export async function resolveTenant(): Promise<TenantContext> {
  const hdr = await headers();
  const slug =
    hdr.get("x-club-slug") ??
    slugFromHost(hdr.get("host")) ??
    process.env.CLUB_SLUG ??
    DEFAULT_CLUB_SLUG;

  const club = await prisma.club.findUnique({ where: { slug } });
  if (club) {
    return { clubId: club.id, slug: club.slug, name: club.name };
  }

  // Auto-provision the default club on first resolve so the schema is
  // populated without a manual seed step.
  if (slug === DEFAULT_CLUB_SLUG) {
    const created = await prisma.club.upsert({
      where: { id: DEFAULT_CLUB_ID },
      create: {
        id: DEFAULT_CLUB_ID,
        slug: DEFAULT_CLUB_SLUG,
        name: process.env.CLUB_NAME ?? "Club OS",
      },
      update: {},
    });
    return { clubId: created.id, slug: created.slug, name: created.name };
  }

  // Subdomain doesn't match any club; fall back to default. (We don't
  // 404 here because that would surface as a hard error during deploy
  // before the operator has provisioned tenants.)
  const fallback = await prisma.club.findUnique({ where: { id: DEFAULT_CLUB_ID } });
  return fallback
    ? { clubId: fallback.id, slug: fallback.slug, name: fallback.name }
    : { clubId: DEFAULT_CLUB_ID, slug: DEFAULT_CLUB_SLUG, name: process.env.CLUB_NAME ?? "Club OS" };
}

/**
 * Resolve the tenant from cookie storage (for client-side reading) or
 * from default. Used in contexts where we can't call resolveTenant()
 * (e.g. some webhook paths) but still want a deterministic answer.
 */
export async function tenantFromCookie(): Promise<string> {
  const store = await cookies();
  return store.get("clubos-tenant")?.value ?? DEFAULT_CLUB_ID;
}
