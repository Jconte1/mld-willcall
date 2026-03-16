"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type NavItem = { href: string; label: string; adminOnly?: boolean };

export default function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteCustomerId, setInviteCustomerId] = useState("");
  const [inviteZip, setInviteZip] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const navItems: NavItem[] = useMemo(
    () => [
      { href: "/staff/pickups", label: "Calendar" },
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

  const handleResendInvite = async () => {
    const customerId = inviteCustomerId.trim().toUpperCase();
    const zip = inviteZip.replace(/\D/g, "").slice(0, 5);
    const email = inviteEmail.trim();

    if (!/^BA\d{7}$/.test(customerId)) {
      toast({ title: "Invalid Customer ID#", description: "Enter a Customer ID# in the format BA1234567." });
      return;
    }
    if (zip.length !== 5) {
      toast({ title: "Invalid ZIP", description: "Enter a 5-digit billing ZIP code." });
      return;
    }
    if (!email) {
      toast({ title: "Invalid email", description: "Enter a valid email address." });
      return;
    }

    setInviteSubmitting(true);
    try {
      const res = await fetch("/api/staff/invites/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, billingZip: zip, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Unable to send",
          description: data?.message ?? "Please check the details and try again.",
        });
        return;
      }
      toast({ title: "Invite sent", description: "The customer will receive their invite code shortly." });
      setShowInviteDialog(false);
      setInviteCustomerId("");
      setInviteZip("");
      setInviteEmail("");
    } catch {
      toast({ title: "Unable to send", description: "Please try again in a moment." });
    } finally {
      setInviteSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="container max-w-none px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/staff" className="font-semibold tracking-tight ml-6">
              Dashboard
            </Link>

            <nav className="hidden md:flex items-center gap-1 ml-3">
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
                {session.user.role === "SALESPERSON" ? (
                  <Link
                    href="/staff/salesperson-profile"
                    className={cn(
                      "px-3 py-2 text-sm rounded-md transition-colors border border-input bg-white",
                      pathname.startsWith("/staff/salesperson-profile")
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    My Profile
                  </Link>
                ) : null}
                <Button
                  variant="outline"
                  className="bg-white"
                  onClick={() => setShowInviteDialog(true)}
                >
                  Invite a customer
                </Button>
                {session.user.role === "ADMIN" ||
                session.user.role === "STAFF" ||
                session.user.role === "SALESPERSON" ? (
                  <Button
                    variant="outline"
                    className="bg-white"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.sessionStorage.setItem("staff_pickups_open_new", "1");
                        if (pathname.startsWith("/staff/pickups")) {
                          window.dispatchEvent(new Event("staff:new-appointment"));
                        } else {
                          router.push("/staff/pickups");
                        }
                      }
                    }}
                  >
                    + New Appointment
                  </Button>
                ) : null}
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

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resend invite</DialogTitle>
            <DialogDescription>
              Enter the customer details to resend their invite code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Customer ID#</label>
              <Input
                value={inviteCustomerId}
                onChange={(event) => setInviteCustomerId(event.target.value)}
                placeholder="BA1234567"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Billing ZIP</label>
              <Input
                value={inviteZip}
                onChange={(event) => setInviteZip(event.target.value)}
                placeholder="84043"
                inputMode="numeric"
                maxLength={5}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@example.com"
                type="email"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
              disabled={inviteSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleResendInvite} disabled={inviteSubmitting}>
              {inviteSubmitting ? "Sending..." : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
