// components/layout/Header.tsx
"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Users } from 'lucide-react';
import { signOut, useSession } from "next-auth/react";
import BrandMark from "@/components/brand/BrandMark";
import { appPath } from "@/lib/paths";
import { cn } from '@/lib/utils';
import { withPublicBasePath } from "@/lib/publicPath"

const Header: React.FC = () => {
  const pathname = usePathname() ?? "";
  const isStaffRoute = pathname.startsWith("/staff");
  const isStaffLogin = pathname === "/staff/login";
  const scheduleActive = !isStaffRoute || isStaffLogin;
  const staffActive = isStaffRoute && !isStaffLogin;
  const staffHref = isStaffLogin ? "/" : "/staff";
  const staffLabel = isStaffLogin ? "Customer" : "Staff";
  const { data: session, status } = useSession();
  const hideStaffNavForCustomer =
    status === "authenticated" && session?.user?.type === "customer";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <Link href={withPublicBasePath("/")} className="flex items-center gap-2 group">
          <BrandMark size={60} className="group-hover:opacity-90 transition-opacity" />
          <span className="font-display text-xl font-semibold text-foreground">
            Will<span className="text-primary">Call</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1">
            <Link
              href={withPublicBasePath("/")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                scheduleActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Schedule</span>
            </Link>

            {!hideStaffNavForCustomer ? (
              <Link
                href={staffHref}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  staffActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">{staffLabel}</span>
              </Link>
            ) : null}
          </nav>
          {status === "authenticated" ? (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: appPath("/") })}
              className="hidden sm:inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default Header;
