import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { SubmitButton } from "@/components/SubmitButton";
import { resolveTenant, DEFAULT_CLUB_ID } from "@/lib/tenant";
import { createClubAction } from "./actions";
import { SettingsTabs } from "../tabs";

export default async function ClubsSettingsPage() {
  await requireCapability("settings.write");
  const current = await resolveTenant();

  const clubs = await prisma.club.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsTabs active="clubs" />

      <section className="max-w-3xl space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Clubs (tenants)</h2>
          <p className="text-xs text-gray-500">Current: <strong>{current.slug}</strong></p>
        </div>
        <p className="text-xs text-gray-500">
          Multi-tenant foundation. Each row is a Club tenant; new clubs map
          to subdomains (e.g. <code>pinehurst.club-os.app</code>) or to the
          <code className="ml-1">X-Club-Slug</code> header for API + mobile
          clients. Full per-entity scoping is rolling out incrementally —
          today only User rows carry clubId.
        </p>

        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {clubs.map((club) => (
            <li key={club.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{club.name}</div>
                <div className="text-xs text-gray-500">
                  slug: <code>{club.slug}</code>
                  {" · "}
                  {club._count.users} user{club._count.users === 1 ? "" : "s"}
                  {club.id === DEFAULT_CLUB_ID ? " · default" : ""}
                </div>
              </div>
              {club.id === DEFAULT_CLUB_ID && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-600">
                  Default
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-3xl">
        <form
          action={createClubAction}
          className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 text-sm"
        >
          <h2 className="text-sm font-semibold text-gray-700">Add a club</h2>
          <label className="block">
            <span className="text-xs font-medium uppercase text-gray-500">Slug</span>
            <input
              type="text"
              name="slug"
              required
              placeholder="pinehurst"
              pattern="[a-z0-9][a-z0-9-]*"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              Lowercase letters, numbers, hyphens. Used in the subdomain
              (<code>{`{slug}`}.club-os.app</code>) and the X-Club-Slug header.
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase text-gray-500">Display name</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Pinehurst Country Club"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Creating…">Create club</SubmitButton>
          </div>
        </form>
      </section>

      <section className="max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <strong>Roll-out roadmap (not yet shipped):</strong> Prisma client
        extension that auto-injects <code>where: clubId</code> on every
        query; Postgres RLS policies as defense-in-depth; clubId added to
        Member, Group, Event, Invoice, HouseCharge, Conversation,
        SavedPaymentMethod, MCPToken etc. tables; per-club Stripe / Twilio
        / SES isolation audit. Until those land, all data lives in the
        &ldquo;default&rdquo; club regardless of the resolved tenant — the foundation
        is here, but enforcement is a follow-up.
      </section>
    </div>
  );
}
