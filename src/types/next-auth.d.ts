import NextAuth, { DefaultSession } from "next-auth";

export type StaffRole = "ADMIN" | "STAFF" | "VIEWER";
export type CustomerAccountRole = "ADMIN" | "PM";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      type?: "staff" | "customer";
      role: StaffRole;
      locationAccess: string[]; // e.g. ["slc-hq", "slc-outlet", "boise-willcall"]
      mustChangePassword: boolean;
      isActive: boolean;
      staffToken?: string | null;
      baid?: string | null;
      phone?: string | null;
      emailVerified?: boolean;
      accountRole?: CustomerAccountRole | null;
      isDeveloper?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: StaffRole;
    locationAccess: string[];
    mustChangePassword: boolean;
    isActive: boolean;
    token?: string | null;
    type?: "staff" | "customer";
    baid?: string | null;
    phone?: string | null;
    emailVerified?: boolean;
    accountRole?: CustomerAccountRole | null;
    isDeveloper?: boolean;
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
    type?: "staff" | "customer";
    baid?: string | null;
    phone?: string | null;
    emailVerified?: boolean;
    accountRole?: CustomerAccountRole | null;
    isDeveloper?: boolean;
  }
}
