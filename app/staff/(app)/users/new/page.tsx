"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { pickupLocations } from "@/lib/pickupLocations";

const LOCATION_IDS = ["slc-hq", "slc-outlet", "boise-willcall"] as const;

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z
    .string()
    .email("Enter a valid email")
    .refine((v) => v.toLowerCase().endsWith("@mld.com"), "Email must be @mld.com"),
  role: z.enum(["STAFF", "ADMIN"]),
  locationAccess: z.array(z.enum(LOCATION_IDS)).min(1, "Select at least one location"),
});

type Values = z.infer<typeof schema>;

export default function StaffUsersNewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      role: "STAFF",
      locationAccess: ["slc-hq"],
    },
  });

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    try {
      // Backend will generate a temp password and email the user.
      const res = await fetch("/api/staff/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to create user");
      }
      toast({ title: "User created", description: "They can now sign in with the temp password." });
      router.push("/staff/users");
    } catch (e: any) {
      toast({ title: "Could not create user", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="shadow-xl max-w-2xl">
      <CardHeader>
        <CardTitle>Create Staff User</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    Staff can manage pickups for their locations. Admin can manage everything.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
