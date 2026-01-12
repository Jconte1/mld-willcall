import NextAuth, { DefaultSession } from "next-auth";

export type StaffRole = "ADMIN" | "STAFF";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: StaffRole;
      locationAccess: string[]; // e.g. ["slc-hq", "slc-outlet", "boise-willcall"]
      mustChangePassword: boolean;
      isActive: boolean;
      staffToken?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: StaffRole;
    locationAccess: string[];
    mustChangePassword: boolean;
    isActive: boolean;
    token?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: StaffRole;
    locationAccess?: string[];
    mustChangePassword?: boolean;
    isActive?: boolean;
    staffToken?: string | null;
  }
}
