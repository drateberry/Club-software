import type { NextAuthConfig } from "next-auth";

// Edge-safe Auth.js config used by middleware. No Prisma adapter, no Node-only
// providers here — those live in src/auth.ts.
export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const publicPaths = ["/login", "/pay", "/checkin", "/api/webhooks", "/api/mcp", "/.well-known"];
      const isPublic = publicPaths.some((p) => pathname.startsWith(p));
      if (isPublic) return true;

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
