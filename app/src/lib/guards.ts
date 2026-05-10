import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasCapability, type Capability } from "@/lib/capabilities";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function requireCapability(cap: Capability) {
  const session = await requireSession();
  const role = session.user.role;
  const explicit = (session.user.capabilities ?? []) as Capability[];
  if (!hasCapability(role, explicit, cap)) {
    redirect("/");
  }
  return session;
}
