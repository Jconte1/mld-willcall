"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { StaffRole } from "@/types/next-auth";
import { pickupLocations } from "@/lib/pickupLocations";

type StaffUserRow = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  locationAccess: string[];
};

export default function StaffUsersPage() {
  const { data: session } = useSession();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<StaffUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetch("/api/staff/users")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!active) return;
        if (!ok) {
          setError(data?.message ?? "Unable to load users.");
          return;
        }
        setRows(Array.isArray(data?.users) ? data.users : []);
      })
      .catch(() => {
        if (active) setError("Unable to load users.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((u) =>
      [u.email, u.name, u.role, u.locationAccess.join(",")].some((v) => v.toLowerCase().includes(needle))
    );
  }, [q, rows]);

  const locationName = (id: string) => pickupLocations.find((loc) => loc.id === id)?.name ?? id;

  return (
    <Card className="shadow-xl">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Staff Users</CardTitle>
          <Button asChild>
            <Link href="/staff/users/new">
              <UserPlus className="h-4 w-4 mr-2" />
              New user
            </Link>
          </Button>
        </div>
        {session?.user?.role !== "ADMIN" ? (
          <p className="text-sm text-muted-foreground mt-2">
            Admin-only. You should not see this if routing guards are working.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users..." className="pl-9" />
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Locations</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-6 text-muted-foreground" colSpan={6}>
                    Loading users...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="p-6 text-destructive" colSpan={6}>
                    {error}
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="p-6 text-muted-foreground" colSpan={6}>
                    No users match your search.
                  </td>
                </tr>
              ) : (
                filteredRows.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-3 font-medium">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>{u.role}</Badge>
                    </td>
                    <td className="p-3">
                      {u.locationAccess.length ? u.locationAccess.map(locationName).join(", ") : "No locations"}
                    </td>
                    <td className="p-3">
                      <Badge variant={u.isActive ? "outline" : "destructive"}>{u.isActive ? "Active" : "Disabled"}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/staff/users/${u.id}`}>Edit</Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
