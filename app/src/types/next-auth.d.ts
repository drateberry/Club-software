import type { DefaultSession } from "next-auth";

type Role = "OPERATOR" | "ADMIN" | "STAFF" | "MEMBER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      capabilities: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    capabilities?: string[];
  }
}
