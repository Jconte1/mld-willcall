"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; adminOnly?: boolean };

export default function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { data: session, status } = useSession();

  const navItems: NavItem[] = useMemo(
    () => [
      { href: "/staff/pickups", label: "Pickups" },
      { href: "/staff/users", label: "Users", adminOnly: true },
    ],
    []
  );

  const userRole = session?.user?.role;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/staff/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (status === "authenticated") {
      if (session.user.mustChangePassword && !pathname.startsWith("/staff/change-password")) {
        router.replace("/staff/change-password");
        return;
      }
      if (
        session.user.mustCompleteProfile &&
        !pathname.startsWith("/staff/salesperson-profile")
      ) {
        router.replace("/staff/salesperson-profile");
      }
    }
  }, [status, session, pathname, router]);

  const visibleNav = navItems.filter((item) => !item.adminOnly || userRole === "ADMIN");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/staff" className="font-semibold tracking-tight">
              Dashboard
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {visibleNav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-3 py-2 text-sm rounded-md transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {status === "authenticated" ? (
              <>
                <div className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Staff mode</span>
                  <span className="text-sm font-medium">{session.user.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {session.user.role === "ADMIN"
                      ? "Admin"
                      : session.user.role === "VIEWER"
                        ? "Viewer"
                        : session.user.role === "SALESPERSON"
                          ? "Salesperson"
                          : "Staff"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="bg-white"
                  onClick={() => signOut({ callbackUrl: "/staff/login" })}
                >
                  Sign out
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="container max-w-none px-6 py-6">{children}</main>
    </div>
  );
}
