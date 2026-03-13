"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z
  .object({
    password: z.string().min(1, "Password is required"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const resetType = useMemo(() => (params.get("type") === "staff" ? "staff" : "customer"), [params]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: FormValues) => {
    if (!token) {
      setError("Reset link is missing or invalid.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: values.password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data?.message === "string" ? data.message : "Unable to reset password.");
        return;
      }

      setIsDone(true);
      const resolvedType = data?.type === "staff" || data?.type === "customer" ? data.type : resetType;
      const destination = resolvedType === "staff" ? "/staff/login?reset=success" : "/?reset=success";
      setTimeout(() => router.push(destination), 1200);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="flex items-center justify-center py-10">
        <div className="w-full max-w-md px-4">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
            </CardHeader>
            <CardContent>
              {!token ? (
                <div className="space-y-3">
                  <p className="text-sm text-destructive">Reset link is missing or invalid.</p>
                  <Link href="/forgot-password" className="text-sm underline">
                    Request a new link
                  </Link>
                </div>
              ) : isDone ? (
                <p className="text-sm text-muted-foreground">Password updated. Redirecting to sign in...</p>
              ) : (
                <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Enter your new password.
                  </p>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="password"
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
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm password</FormLabel>
                            <FormControl>
                              <Input type="password" autoComplete="new-password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" variant="hero" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? "Updating..." : "Update password"}
                      </Button>
                    </form>
                  </Form>
                </>
              )}

              {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
