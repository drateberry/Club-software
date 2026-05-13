import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { prisma } from "@/lib/db";
import { enterTenantContext, enterOperatorContext, getTenantContext } from "@/lib/tenantContext";

/**
 * Auth gate for Server Components and Server Actions. Also establishes
 * the tenant context for the rest of the async call chain via
 * AsyncLocalStorage.enterWith() so every subsequent Prisma query is
 * automatically scoped to the user's club. No further wrapping needed
 * in action bodies.
 *
 * OPERATOR role enters a special "asOperator" scope where the Prisma
 * extension is a no-op — cross-club admin pages can see everything.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Only resolve tenant once per request. Skip if a context is already
  // active (e.g. recursive Server Action call within the same chain).
  if (!getTenantContext()) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { clubId: true, role: true },
    });
    if (user?.role === "OPERATOR") {
      enterOperatorContext();
    } else {
      enterTenantContext(user?.clubId ?? "default");
    }
  }

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
