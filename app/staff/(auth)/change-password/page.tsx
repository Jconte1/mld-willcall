"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const passwordRules = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/\d/, "Password must include at least 1 number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least 1 symbol");

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordRules,
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function StaffChangePasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status, update } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/staff/login");
      return;
    }
    if (status === "authenticated" && session?.user?.mustChangePassword === false) {
      router.replace("/staff");
    }
  }, [router, session?.user?.mustChangePassword, status]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      console.info("[staff-change-password] submitting");
      const res = await fetch("/api/staff/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      console.info("[staff-change-password] response", { ok: res.ok, status: res.status, data });
      if (!res.ok) {
        throw new Error(data?.message || "Unable to change password");
      }

      // Update session token so middleware stops redirecting.
      try {
        const updatedSession = await update({ mustChangePassword: false });
        console.info("[staff-change-password] session updated", updatedSession);
      } catch (err) {
        console.error("[staff-change-password] session update failed", err);
      }

      toast({ title: "Password updated", description: "You're all set." });
      router.replace("/staff");
    } catch (err: any) {
      console.error("[staff-change-password] error", err);
      toast({ title: "Password change failed", description: err?.message || "Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="container py-10">
      <div className="max-w-lg mx-auto">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Change your password</CardTitle>
            <p className="text-sm text-muted-foreground">
              For security, you must set a new password before using staff tools.
            </p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm new password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Update password"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
