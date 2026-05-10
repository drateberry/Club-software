import Link from "next/link";
import { ComplianceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { formatDate } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteCertificate } from "./actions";

const TABS = ["overview", "expiring"] as const;
type Tab = (typeof TABS)[number];

const HORIZON_DAYS = 90;

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireCapability("compliance.read");
  const { tab = "overview" } = await searchParams;
  const activeTab: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "overview";

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + HORIZON_DAYS);

  const where =
    activeTab === "expiring"
      ? {
          expiresOn: { lte: horizon, gte: new Date() },
          status: { not: ComplianceStatus.REVOKED },
        }
      : {};

  const [certificates, expiringSoon] = await Promise.all([
    prisma.complianceCertificate.findMany({
      where,
      include: { member: true },
      orderBy: [{ expiresOn: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.complianceCertificate.count({
      where: {
        expiresOn: { lte: horizon, gte: new Date() },
        status: { not: ComplianceStatus.REVOKED },
      },
    }),
  ]);

  const canWrite = hasCapability(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[],
    "compliance.write"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Compliance</h1>
        {canWrite && (
          <Link
            href="/compliance/new"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
          >
            Add certificate
          </Link>
        )}
      </div>

      <nav className="flex gap-2 text-sm">
        <Link
          href="/compliance"
          className={`rounded border px-3 py-1 ${
            activeTab === "overview"
              ? "border-black bg-black text-white"
              : "border-gray-300 bg-white"
          }`}
        >
          Overview
        </Link>
        <Link
          href="/compliance?tab=expiring"
          className={`rounded border px-3 py-1 ${
            activeTab === "expiring"
              ? "border-black bg-black text-white"
              : "border-gray-300 bg-white"
          }`}
        >
          Expiring in {HORIZON_DAYS} days{" "}
          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase text-amber-900">
            {expiringSoon}
          </span>
        </Link>
      </nav>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Member</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Certified</th>
              <th className="px-4 py-2">Expires</th>
              {canWrite && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {certificates.length === 0 ? (
              <tr>
                <td
                  colSpan={canWrite ? 6 : 5}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  {activeTab === "expiring"
                    ? "Nothing expiring soon."
                    : "No certificates yet."}
                </td>
              </tr>
            ) : (
              certificates.map((cert) => {
                const del = deleteCertificate.bind(null, cert.id);
                return (
                  <tr key={cert.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/members/${cert.memberId}`}
                        className="hover:underline"
                      >
                        {cert.member.firstName} {cert.member.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{cert.type}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs uppercase ${
                          cert.status === "CERTIFIED"
                            ? "bg-green-100 text-green-900"
                            : cert.status === "EXPIRED" || cert.status === "REVOKED"
                              ? "bg-red-100 text-red-900"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {cert.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {formatDate(cert.certifiedOn)}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {formatDate(cert.expiresOn)}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-2 text-right">
                        <form action={del}>
                          <ConfirmButton
                            message="Delete this certificate?"
                            confirmLabel="Delete"
                            pendingLabel="Deleting…"
                          >
                            Delete
                          </ConfirmButton>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
