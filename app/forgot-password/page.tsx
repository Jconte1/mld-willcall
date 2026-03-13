"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type FormValues = z.infer<typeof schema>;

function ForgotPasswordContent() {
  const params = useSearchParams();
  const type = params.get("type") === "staff" ? "staff" : "customer";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    if (type === "staff" && !values.email.toLowerCase().endsWith("@mld.com")) {
      form.setError("email", { message: "Must use an @mld.com email" });
      return;
    }

    setIsSubmitting(true);
    setSubmitted(false);
    setMessage("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, type }),
      });
      const data = await res.json().catch(() => ({}));

      setSubmitted(true);
      setMessage(
        typeof data?.message === "string"
          ? data.message
          : "If your email exists, you'll receive a reset link shortly."
      );
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
              <CardTitle>{type === "staff" ? "Staff Forgot Password" : "Customer Forgot Password"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Enter your email and we&apos;ll send a password reset link.
              </p>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" variant="hero" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Sending..." : "Send reset link"}
                  </Button>
                </form>
              </Form>

              {submitted ? (
                <p className="mt-4 text-sm text-muted-foreground">{message}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
