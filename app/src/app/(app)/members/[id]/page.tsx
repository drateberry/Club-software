import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { formatDate, formatMoney } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { updateMember, deleteMember } from "../actions";
import { AddressEditor } from "./AddressEditor";
import { generateMemberPass } from "@/app/(app)/checkin/actions";
import { sendToMember, reOptIn } from "@/app/(app)/messages/actions";
import { formatHuman } from "@/lib/twilio/normalize";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCapability("members.read");
  const t = await getTranslations();
  const { id } = await params;

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      user: { select: { passToken: true } },
      addresses: { orderBy: { isPrimary: "desc" } },
      dependents: true,
      groupMemberships: { include: { group: true } },
      committeeMemberships: { include: { committee: true } },
      invoices: {
        where: { status: { in: ["SENT", "DRAFT"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      conversations: {
        select: { id: true, lastMessageAt: true, _count: { select: { messages: true } } },
        orderBy: { lastMessageAt: "desc" },
        take: 1,
      },
    },
  });
  if (!member || member.deletedAt) notFound();

  const canWrite = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "members.write"
  );

  const updateThis = updateMember.bind(null, id);
  const deleteThis = deleteMember.bind(null, id);
  const reOptInThis = reOptIn.bind(null, id);
  const canMessage = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "messaging.write"
  );
  const conversation = member.conversations[0];

  return (
    <div className="space-y-6">
      <Link href="/members" className="text-sm text-gray-600 hover:underline">
        ← {t("members.title")}
      </Link>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">
          {member.firstName} {member.lastName}
        </h1>
        <span className="text-sm text-gray-500">#{member.memberNumber}</span>
      </div>

      <form action={updateThis} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">{t("members.firstName")}</span>
            <input
              type="text"
              name="firstName"
              defaultValue={member.firstName}
              required
              disabled={!canWrite}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-50"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t("members.lastName")}</span>
            <input
              type="text"
              name="lastName"
              defaultValue={member.lastName}
              required
              disabled={!canWrite}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-50"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium">{t("members.email")}</span>
          <input
            type="email"
            name="email"
            defaultValue={member.email ?? ""}
            disabled={!canWrite}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-50"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("members.phone")}</span>
          <input
            type="tel"
            name="phone"
            defaultValue={member.phone ?? ""}
            disabled={!canWrite}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-50"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">{t("members.memberNumber")}</span>
            <input
              type="text"
              name="memberNumber"
              defaultValue={member.memberNumber ?? ""}
              disabled={!canWrite}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-50"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t("members.class")}</span>
            <input
              type="text"
              name="membershipClass"
              defaultValue={member.membershipClass ?? ""}
              disabled={!canWrite}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-50"
            />
          </label>
        </div>
        {canWrite && (
          <div className="flex justify-end gap-2">
            <SubmitButton>{t("members.saveChanges")}</SubmitButton>
          </div>
        )}
      </form>

      <AddressEditor
        memberId={member.id}
        addresses={member.addresses}
        canWrite={canWrite}
      />

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          {t("members.memberships")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs uppercase text-gray-500">{t("nav.groups")}</div>
            <ul className="text-sm">
              {member.groupMemberships.map((gm) => (
                <li key={gm.id}>
                  <Link href={`/groups/${gm.groupId}`} className="hover:underline">
                    {gm.group.name}
                  </Link>
                </li>
              ))}
              {member.groupMemberships.length === 0 && (
                <li className="text-gray-500">—</li>
              )}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-xs uppercase text-gray-500">{t("nav.committees")}</div>
            <ul className="text-sm">
              {member.committeeMemberships.map((cm) => (
                <li key={cm.id}>
                  <Link href={`/committees/${cm.committeeId}`} className="hover:underline">
                    {cm.committee.name}
                  </Link>
                </li>
              ))}
              {member.committeeMemberships.length === 0 && (
                <li className="text-gray-500">—</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {member.invoices.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            {t("nav.invoices")}
          </h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {member.invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-2">
                <Link href={`/finance/invoices/${inv.id}`} className="hover:underline">
                  {inv.number}
                </Link>
                <span className="text-gray-500">
                  {formatMoney(inv.totalCents)} · {formatDate(inv.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canMessage && member.phone && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Send SMS</h2>
            <span className="text-xs text-gray-500">{formatHuman(member.phone)}</span>
          </div>
          {member.twilioOptedOut ? (
            <div className="space-y-2 text-sm">
              <p className="rounded border border-red-200 bg-red-50 p-2 text-red-900">
                This member has opted out of texts. They must reply START, or
                you can record their re-consent below.
              </p>
              <form action={reOptInThis}>
                <SubmitButton variant="secondary" pendingLabel="Updating…">
                  Record re-opt-in
                </SubmitButton>
              </form>
            </div>
          ) : (
            <form action={sendToMember} className="space-y-2">
              <input type="hidden" name="memberId" value={member.id} />
              <textarea
                name="body"
                required
                rows={3}
                placeholder="Type a text message…"
                className="block w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between">
                {conversation && (
                  <Link
                    href={`/messages/${conversation.id}`}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Open thread ({conversation._count.messages} messages) →
                  </Link>
                )}
                <SubmitButton pendingLabel="Sending…">Send SMS</SubmitButton>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Member pass</h2>
        {member.user?.passToken ? (
          <div className="flex items-start gap-4">
            <Image
              src={`/api/pass/${member.user.passToken}`}
              alt="Member pass QR code"
              width={160}
              height={160}
              unoptimized
              className="rounded border border-gray-200"
            />
            <div className="flex-1 text-sm text-gray-600">
              <p>Scan to check in. The QR encodes the member&apos;s personal pass URL.</p>
              {canWrite && (
                <form
                  action={generateMemberPass.bind(null, member.id)}
                  className="mt-3"
                >
                  <SubmitButton variant="secondary">Re-issue pass</SubmitButton>
                </form>
              )}
            </div>
          </div>
        ) : canWrite ? (
          <form action={generateMemberPass.bind(null, member.id)}>
            <SubmitButton>Issue pass</SubmitButton>
            <p className="mt-2 text-xs text-gray-500">
              Creates a user account linked to this member (if missing) and
              generates a stable QR pass.
            </p>
          </form>
        ) : (
          <p className="text-sm text-gray-500">No pass issued.</p>
        )}
      </section>

      {canWrite && (
        <form action={deleteThis} className="pt-4">
          <ConfirmButton
            message={t("members.confirmDelete")}
            confirmLabel={t("members.delete")}
            pendingLabel="Deleting…"
          >
            {t("members.delete")}
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}
