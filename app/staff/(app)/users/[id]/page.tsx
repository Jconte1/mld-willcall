"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { pickupLocations } from "@/lib/pickupLocations";

const LOCATION_IDS = ["slc-hq", "slc-outlet", "boise-willcall"] as const;

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  role: z.enum(["ADMIN", "STAFF"]),
  email: z.string().email(),
  isActive: z.boolean(),
  locationAccess: z.array(z.enum(LOCATION_IDS)).min(1, "Select at least one location"),
});

type FormValues = z.infer<typeof schema>;

export default function StaffUserDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      role: "STAFF",
      email: "",
      isActive: true,
      locationAccess: ["slc-hq"],
    },
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/staff/users/${params.id}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!active) return;
        if (!ok) {
          setError(data?.message ?? "Unable to load user.");
          return;
        }
        const user = data?.user ?? data;
        form.reset({
          name: user?.name ?? "",
          role: user?.role ?? "STAFF",
          email: user?.email ?? "",
          isActive: user?.isActive ?? true,
          locationAccess: Array.isArray(user?.locationAccess) ? user.locationAccess : ["slc-hq"],
        });
      })
      .catch(() => {
        if (active) setError("Unable to load user.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form, params.id]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/staff/users/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Unable to update user");
      }
      toast({ title: "Saved", description: `User ${params.id} updated.` });
      router.push("/staff/users");
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message ?? "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading user...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{error}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => router.push("/staff/users")}>
            Go back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Edit Staff User</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
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
                      <Input placeholder="jane.doe@mld.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="STAFF">Staff</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <FormLabel className="text-base">Active</FormLabel>
                      <p className="text-sm text-muted-foreground">Disable to block login and access.</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="locationAccess"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Access</FormLabel>
                  <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
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
                          <span>{loc.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/staff/users")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
