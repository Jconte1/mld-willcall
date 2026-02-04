"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  salespersonNumber: z
    .string()
    .min(3, "Salesperson number is required")
    .max(5, "Salesperson number must be 3–5 digits")
    .regex(/^\d+$/, "Salesperson number must be digits only"),
  salespersonName: z.string().min(1, "Name is required"),
  salespersonPhone: z.string().optional(),
  salespersonEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function SalespersonProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status, update } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      salespersonNumber: "",
      salespersonName: "",
      salespersonPhone: "",
      salespersonEmail: "",
    },
  });

  useEffect(() => {
    console.info("[salesperson-profile] session", {
      status,
      role: session?.user?.role,
      mustCompleteProfile: session?.user?.mustCompleteProfile,
    });
    if (status === "unauthenticated") {
      router.replace("/staff/login");
      return;
    }
    if (status !== "authenticated") return;
    if (session?.user?.role !== "SALESPERSON") {
      router.replace("/staff");
      return;
    }

    setLoading(true);
    fetch("/api/staff/profile")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        console.info("[salesperson-profile] load", { ok, data });
        if (!ok) return;
        const profile = data?.profile ?? data ?? {};
        form.reset({
          salespersonNumber: profile?.salespersonNumber ?? "",
          salespersonName: profile?.salespersonName ?? "",
          salespersonPhone: formatPhoneInput(profile?.salespersonPhone ?? ""),
          salespersonEmail: profile?.salespersonEmail ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [form, router, session?.user?.role, status]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      console.info("[salesperson-profile] submit");
      const res = await fetch("/api/staff/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salespersonNumber: values.salespersonNumber.trim(),
          salespersonName: values.salespersonName.trim(),
          salespersonPhone: values.salespersonPhone?.replace(/\D/g, "") || null,
          salespersonEmail: values.salespersonEmail?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      console.info("[salesperson-profile] submit response", { ok: res.ok, status: res.status, data });
      if (!res.ok) {
        throw new Error(data?.message || "Unable to save profile");
      }
      await update({ mustCompleteProfile: false });
      toast({ title: "Profile saved", description: "Thanks! You're all set." });
      router.replace("/staff/pickups");
      router.refresh();
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container py-10">
      <div className="max-w-lg mx-auto">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Complete your profile</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your salesperson details so customers can reach you directly.
            </p>
          </CardHeader>
          <CardContent>
            {session?.user?.email ? (
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-muted/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <div>
                  Signed in as <span className="font-medium text-foreground">{session.user.email}</span>
                </div>
                <div>
                  Not you?{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => signOut({ callbackUrl: "/staff/login" })}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="salespersonNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salesperson number</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="numeric" placeholder="1250" disabled={loading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="salespersonName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Jane Doe" disabled={loading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="salespersonPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="(801) 555-5555"
                          inputMode="tel"
                          disabled={loading}
                          onChange={(event) => field.onChange(formatPhoneInput(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="salespersonEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="name@mld.com" disabled={loading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={saving || loading}>
                  {saving ? "Saving..." : "Save to continue"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
