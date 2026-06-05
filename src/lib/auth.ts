import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { appPath } from "./paths";

const STAFF_API_BASE_URL = process.env.STAFF_API_BASE_URL;
const CUSTOMER_API_BASE_URL = process.env.CUSTOMER_API_BASE_URL;

type StaffUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  locationAccess?: string[];
  mustChangePassword?: boolean;
  mustCompleteProfile?: boolean;
  isActive?: boolean;
  token?: string;
};

type CustomerUser = {
  id: string;
  email: string;
  name?: string | null;
  baid?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  accountRole?: string | null;
  isDeveloper?: boolean;
  mustChangePassword?: boolean;
  mustCompleteProfile?: boolean;
};

export const authOptions: NextAuthOptions = {
  pages: {
    // Staff still uses its own login route
    signIn: appPath("/staff/login"),
  },
  session: {
    strategy: "jwt",
    // 1 week
    maxAge: 7 * 24 * 60 * 60,
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        authType: { label: "Auth Type", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        const authType = (credentials as any)?.authType as string | undefined;

        if (!email || !password) return null;

        // Default to staff to preserve the existing staff login page behavior.
        const mode = authType ?? "staff";

        // STAFF LOGIN
        if (mode === "staff") {
          // Minimal safety check to keep staff auth scoped.
          if (!email.endsWith("@mld.com")) return null;
          if (!STAFF_API_BASE_URL) return null;

          const res = await fetch(`${STAFF_API_BASE_URL}/api/staff/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.message || "Invalid credentials");
          }
          const data = await res.json().catch(() => ({}));
          const user = (data?.user ?? data) as StaffUser;
          const token = data?.token as string | undefined;

          if (!user?.id || !user?.email) return null;
          if (user?.isActive === false) return null;

          return { ...user, token, type: "staff" } as any;
        }

        // CUSTOMER LOGIN
        if (mode === "customer") {
          if (!CUSTOMER_API_BASE_URL) return null;

          const res = await fetch(`${CUSTOMER_API_BASE_URL}/api/customer/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.message || "Invalid credentials");
          }
          const data = await res.json().catch(() => ({}));
          const user = (data?.user ?? data) as CustomerUser;

          if (!user?.id || !user?.email) return null;

          return { ...user, type: "customer" } as any;
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        (token as any).id = (user as any).id;
        (token as any).type = (user as any).type;
        (token as any).staffToken = (user as any).token ?? null;

        // Staff fields
        (token as any).role = (user as any).role;
        (token as any).locationAccess = (user as any).locationAccess ?? [];
        (token as any).mustChangePassword = (user as any).mustChangePassword ?? false;
        (token as any).mustCompleteProfile = (user as any).mustCompleteProfile ?? false;
        (token as any).isActive = (user as any).isActive ?? true;

        // Customer fields
        (token as any).baid = (user as any).baid ?? null;
        (token as any).phone = (user as any).phone ?? null;
        (token as any).emailVerified = (user as any).emailVerified ?? false;
        (token as any).name = (user as any).name ?? null;
        (token as any).accountRole = (user as any).accountRole ?? null;
        (token as any).isDeveloper = (user as any).isDeveloper ?? false;
      }

      // Client-side session.update(...)
      if (trigger === "update" && session?.user) {
        (token as any).type = (session.user as any).type ?? (token as any).type;
        (token as any).staffToken = (session.user as any).staffToken ?? (token as any).staffToken;

        (token as any).role = (session.user as any).role ?? (token as any).role;
        (token as any).locationAccess = (session.user as any).locationAccess ?? (token as any).locationAccess;
        (token as any).mustChangePassword = (session.user as any).mustChangePassword ?? (token as any).mustChangePassword;
        (token as any).mustCompleteProfile =
          (session.user as any).mustCompleteProfile ?? (token as any).mustCompleteProfile;
        (token as any).isActive = (session.user as any).isActive ?? (token as any).isActive;

        (token as any).baid = (session.user as any).baid ?? (token as any).baid;
        (token as any).phone = (session.user as any).phone ?? (token as any).phone;
        (token as any).emailVerified = (session.user as any).emailVerified ?? (token as any).emailVerified;
        (token as any).name = (session.user as any).name ?? (token as any).name;
        (token as any).accountRole = (session.user as any).accountRole ?? (token as any).accountRole;
        (token as any).isDeveloper = (session.user as any).isDeveloper ?? (token as any).isDeveloper;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).id as string;
        (session.user as any).type = (token as any).type;
        (session.user as any).staffToken = (token as any).staffToken ?? null;

        (session.user as any).name = (token as any).name ?? session.user.name ?? null;

        // Staff fields
        (session.user as any).role = (token as any).role;
        (session.user as any).locationAccess = ((token as any).locationAccess as string[]) ?? [];
        (session.user as any).mustChangePassword = Boolean((token as any).mustChangePassword);
        (session.user as any).mustCompleteProfile = Boolean((token as any).mustCompleteProfile);
        (session.user as any).isActive = (token as any).isActive !== false;

        // Customer fields
        (session.user as any).baid = (token as any).baid ?? null;
        (session.user as any).phone = (token as any).phone ?? null;
        (session.user as any).emailVerified = Boolean((token as any).emailVerified);
        (session.user as any).accountRole = (token as any).accountRole ?? null;
        (session.user as any).isDeveloper = Boolean((token as any).isDeveloper);
      }
      return session;
    },
  },
};
