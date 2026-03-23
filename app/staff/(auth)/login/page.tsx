"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/Header";

const schema = z.object({
  email: z
    .string()
    .email("Enter a valid email")
    .refine((v) => v.toLowerCase().endsWith("@mld.com"), {
      message: "Must use an @mld.com email",
    }),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

function StaffLoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const { status, data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showDashboardLink =
    status === "authenticated" &&
    !session?.user?.mustChangePassword &&
    !session?.user?.mustCompleteProfile;

  const nextUrl = useMemo(() => params.get("next") || "/staff", [params]);
  const resetSuccess = params.get("reset") === "success";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (status === "authenticated") {
      const target = session.user.mustChangePassword
        ? "/staff/change-password"
        : session.user.mustCompleteProfile
          ? "/staff/salesperson-profile"
          : nextUrl;
      router.replace(target);
    }
  }, [status, session, nextUrl, router]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: values.email,
        password: values.password,
      });

      if (res?.error) {
        toast({ title: "Login failed", description: res.error });
        return;
      }

      // Redirect is handled by session effect to respect profile gating.
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
              <CardTitle>Staff Login</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {resetSuccess ? (
                    <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                      Password updated. Please sign in.
                    </p>
                  ) : null}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="name@mld.com" autoComplete="username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="current-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    variant="hero"
                    className="w-full"
                    disabled={isSubmitting || showDashboardLink}
                  >
                    {isSubmitting ? "Signing in..." : "Sign in"}
                  </Button>
                  {showDashboardLink ? (
                    <Button
                      type="button"
                      variant="hero"
                      className="w-full bg-black text-white hover:bg-black/90"
                      onClick={() => {
                        router.push("/staff");
                        setTimeout(() => {
                          window.location.assign("/staff");
                        }, 150);
                      }}
                    >
                      Go to dashboard
                    </Button>
                  ) : null}
                  <div className="text-center">
                    <Link href="/forgot-password?type=staff" className="text-sm text-muted-foreground underline">
                      Forgot password
                    </Link>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <StaffLoginContent />
    </Suspense>
  );
}
