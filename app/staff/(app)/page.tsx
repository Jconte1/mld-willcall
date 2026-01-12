"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StaffHomePage() {
  const { data: session } = useSession();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Staff Dashboard</h1>
          <p className="text-muted-foreground">Signed in as {session?.user?.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/staff/pickups" className="block">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>Pickups</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                View and manage pickups for your location(s).
              </CardContent>
            </Card>
          </Link>

          {session?.user?.role === "ADMIN" && (
            <Link href="/staff/users" className="block">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle>Users</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Create, edit, or disable staff users.
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
    </div>
  );
}
