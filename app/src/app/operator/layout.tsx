import Link from "next/link";
import { requireOperator } from "@/lib/guards";
import { signOutAction } from "@/app/(app)/actions";

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOperator();

  return (
    <div className="flex h-screen w-screen flex-col">
      <header className="flex items-center justify-between border-b border-amber-300 bg-amber-50 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/operator/clubs" className="text-base font-semibold">
            Club OS · Operator
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/operator/clubs" className="hover:underline">
              Clubs
            </Link>
            <Link href="/operator/audit" className="hover:underline">
              Audit
            </Link>
            <Link href="/" className="text-gray-600 hover:underline">
              Back to app
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-xs text-amber-900">
          <span>Operator: {session.user.email}</span>
          <form action={signOutAction}>
            <button type="submit" className="text-amber-900 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
    </div>
  );
}
