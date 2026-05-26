"use client";

import { apiPath } from "@/lib/paths";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Search, UserPlus } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { StaffRole } from "@/types/next-auth";
import { pickupLocations } from "@/lib/pickupLocations";

type StaffUserRow = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  locationAccess: string[];
  salespersonNumber?: string | null;
  salespersonName?: string | null;
  salespersonPhone?: string | null;
  salespersonEmail?: string | null;
};

const LOCATION_IDS = [
  "slc-hq",
  "slc-outlet",
  "boise-willcall",
  "jackson-willcall",
  "provo-willcall",
] as const;
type LocationId = (typeof LOCATION_IDS)[number];
const LOCATION_SET = new Set<LocationId>(LOCATION_IDS);
const DESTRUCTIVE_BUTTON = "bg-red-500 text-white hover:bg-red-600 hover:-translate-y-[1px] transition-transform";

const createSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z
    .string()
    .email("Enter a valid email")
    .refine((v) => v.toLowerCase().endsWith("@mld.com"), "Email must be @mld.com"),
  role: z.enum(["STAFF", "ADMIN", "VIEWER", "SALESPERSON"]),
  locationAccess: z.array(z.enum(LOCATION_IDS)).min(1, "Select at least one location"),
});

const editSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z
    .string()
    .email("Enter a valid email")
    .refine((v) => v.toLowerCase().endsWith("@mld.com"), "Email must be @mld.com"),
  role: z.enum(["STAFF", "ADMIN", "VIEWER", "SALESPERSON"]),
  locationAccess: z.array(z.enum(LOCATION_IDS)).min(1, "Select at least one location"),
  salespersonNumber: z.string().optional().or(z.literal("")),
  salespersonName: z.string().optional().or(z.literal("")),
  salespersonPhone: z.string().optional().or(z.literal("")),
  salespersonEmail: z.string().optional().or(z.literal("")),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

export default function StaffUsersPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<StaffUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "STAFF",
      locationAccess: ["slc-hq"],
    },
  });

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "STAFF",
      locationAccess: ["slc-hq"],
      salespersonNumber: "",
      salespersonName: "",
      salespersonPhone: "",
      salespersonEmail: "",
    },
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetch(apiPath("/api/staff/users"))
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
      [
        u.email,
        u.name,
        u.role,
        u.locationAccess.join(","),
        u.salespersonNumber ?? "",
        u.salespersonName ?? "",
      ].some((v) => v.toLowerCase().includes(needle))
    );
  }, [q, rows]);

  const locationName = (id: string) => pickupLocations.find((loc) => loc.id === id)?.name ?? id;

  const toLocationAccess = (values: string[] | null | undefined): LocationId[] => {
    const safe = (values ?? []).filter((value): value is LocationId =>
      LOCATION_SET.has(value as LocationId)
    );
    return safe.length ? safe : [LOCATION_IDS[0]];
  };

  const handleCreate = async (values: CreateValues) => {
    setCreating(true);
    try {
      const res = await fetch(apiPath("/api/staff/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to create user");
      }
      const data = await res.json().catch(() => ({}));
      const nextUser = data?.user ?? null;
      if (nextUser) {
        setRows((prev) => [nextUser, ...prev]);
      } else {
        setRows((prev) => [...prev]);
      }
      if (data?.emailSent === false) {
        toast({
          title: "User created, email not sent",
          description: data?.message ?? "Onboarding email failed to send.",
          variant: "destructive",
        });
      } else {
        toast({ title: "User created", description: "They can now sign in with the temp password." });
      }
      form.reset({
        name: "",
        email: "",
        role: "STAFF",
        locationAccess: ["slc-hq"],
      });
      setCreateOpen(false);
    } catch (err: any) {
      toast({ title: "Could not create user", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete ${email}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(apiPath(`/api/staff/users/${id}`), { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Unable to delete user.");
      }
      setRows((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      setError(err?.message ?? "Unable to delete user.");
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (user: StaffUserRow) => {
    setEditingId(user.id);
    editForm.reset({
      name: user.name ?? "",
      email: user.email ?? "",
      role: user.role ?? "STAFF",
      locationAccess: toLocationAccess(user.locationAccess),
      salespersonNumber: user.salespersonNumber ?? "",
      salespersonName: user.salespersonName ?? "",
      salespersonPhone: user.salespersonPhone ?? "",
      salespersonEmail: user.salespersonEmail ?? "",
    } as EditValues);
    setEditOpen(true);
  };

  const handleEdit = async (values: EditValues) => {
    if (!editingId) return;
    setEditing(true);
    try {
      const res = await fetch(apiPath(`/api/staff/users/${editingId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Unable to update user");
      }
      const data = await res.json().catch(() => ({}));
      const updated = data?.user ?? null;
      if (updated) {
        setRows((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      }
      toast({ title: "Saved", description: `User updated.` });
      setEditOpen(false);
      setEditingId(null);
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message ?? "Please try again." });
    } finally {
      setEditing(false);
    }
  };

  return (
    <Card className="shadow-xl">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Staff Users</CardTitle>
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            New user
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
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDelete(u.id, u.email)}
                          disabled={deletingId === u.id}
                          className={DESTRUCTIVE_BUTTON}
                        >
                          {deletingId === u.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Staff User</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Jane Doe" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="jane.doe@mld.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        {...field}
                      >
                        <option value="STAFF">Staff</option>
                        <option value="VIEWER">Viewer</option>
                        <option value="SALESPERSON">Salesperson</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationAccess"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Access</FormLabel>
                    <div className="grid gap-2">
                      {pickupLocations.map((loc) => {
                        const checked = field.value?.includes(loc.id as (typeof LOCATION_IDS)[number]);
                        return (
                          <label key={loc.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const next = new Set(field.value ?? []);
                                if (v) next.add(loc.id as (typeof LOCATION_IDS)[number]);
                                else next.delete(loc.id as (typeof LOCATION_IDS)[number]);
                                field.onChange(Array.from(next));
                              }}
                            />
                            {loc.name} ({loc.id})
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Staff can manage pickups for their locations. Viewer is read-only. Admin can manage everything.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <Button type="button" onClick={() => setCreateOpen(false)} className={DESTRUCTIVE_BUTTON}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={(open) => {
        if (!open) {
          setEditingId(null);
        }
        setEditOpen(open);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Staff User</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-6">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Jane Doe" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="jane.doe@mld.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        {...field}
                      >
                        <option value="STAFF">Staff</option>
                        <option value="VIEWER">Viewer</option>
                        <option value="SALESPERSON">Salesperson</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="locationAccess"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Access</FormLabel>
                    <div className="grid gap-2">
                      {pickupLocations.map((loc) => {
                        const checked = field.value?.includes(loc.id as (typeof LOCATION_IDS)[number]);
                        return (
                          <label key={loc.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const next = new Set(field.value ?? []);
                                if (v) next.add(loc.id as (typeof LOCATION_IDS)[number]);
                                else next.delete(loc.id as (typeof LOCATION_IDS)[number]);
                                field.onChange(Array.from(next));
                              }}
                            />
                            {loc.name} ({loc.id})
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Staff can manage pickups for their locations. Viewer is read-only. Admin can manage everything.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editForm.watch("role") === "SALESPERSON" ? (
                <>
                  <FormField
                    control={editForm.control}
                    name="salespersonNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salesperson number</FormLabel>
                        <FormControl>
                          <Input {...field} inputMode="numeric" placeholder="1250" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="salespersonName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salesperson name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Jane Doe" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="salespersonPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="(801) 555-5555" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="salespersonEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="name@mld.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : null}

              <DialogFooter className="gap-2">
                <Button type="button" onClick={() => setEditOpen(false)} className={DESTRUCTIVE_BUTTON}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editing}>
                  {editing ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
