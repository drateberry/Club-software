import { Sidebar } from "@/components/Sidebar";
import { requireSession } from "@/lib/guards";
import { effectiveCapabilities, type Capability } from "@/lib/capabilities";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const capabilities = effectiveCapabilities(
    session.user.role,
    (session.user.capabilities ?? []) as Capability[]
  );
  const appName = process.env.CLUB_NAME ?? "Club OS";

  return (
    <div className="flex h-screen w-screen">
      <Sidebar
        capabilities={capabilities}
        userEmail={session.user.email ?? ""}
        appName={appName}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  );
}
