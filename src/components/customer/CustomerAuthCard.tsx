"use client";

import { apiPath } from "@/lib/paths";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import BrandMark from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import PhoneInput from "@/components/system/PhoneInput";
import FullPageSyncLoader from "@/components/system/FullPageSyncLoader";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

const PREFILL_TOKENS_IN_FLIGHT = new Set<string>();
const PREFILL_TOKENS_COMPLETED = new Set<string>();

function extractEmailFromPrefillToken(token: string): string {
  try {
    const payloadB64 = String(token || "").split(".")[0] || "";
    if (!payloadB64) return "";
    const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = atob(normalized + padding);
    const payload = JSON.parse(json) as { e?: string | null };
    return String(payload?.e || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

export default function CustomerAuthCard() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState(0);
  const [showResend, setShowResend] = React.useState(false);
  const [resendMode, setResendMode] = React.useState<"email" | "phone">("email");
  const [resendOrderNbr, setResendOrderNbr] = React.useState("");
  const [resendEmail, setResendEmail] = React.useState("");
  const [resendPhone, setResendPhone] = React.useState("");
  const [resendSubmitting, setResendSubmitting] = React.useState(false);
  const [autoOnboarding, setAutoOnboarding] = React.useState(false);
  const resetSuccess = searchParams.get("reset") === "success";
  const prefillToken = searchParams.get("prefillToken");
  const loginEmailPrefill = searchParams.get("email") || "";
  const loginNotice = searchParams.get("notice") || "";
  const accountExistsNotice =
    loginNotice === "account-exists"
      ? "An account under this email already exists. Please sign in."
      : "";

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  React.useEffect(() => {
    if (!loginEmailPrefill) return;
    loginForm.setValue("email", loginEmailPrefill);
  }, [loginEmailPrefill, loginForm]);

  React.useEffect(() => {
    if (!syncing && !autoOnboarding) return;
    setSyncProgress(0);
    const interval = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 92) return prev;
        const bump = 3 + Math.random() * 6;
        return Math.min(92, prev + bump);
      });
    }, 600);
    return () => clearInterval(interval);
  }, [syncing, autoOnboarding]);

  React.useEffect(() => {
    if (!prefillToken) return;
    if (sessionStatus === "authenticated") return;
    const token = prefillToken;
    if (PREFILL_TOKENS_COMPLETED.has(token) || PREFILL_TOKENS_IN_FLIGHT.has(token)) {
      return;
    }
    PREFILL_TOKENS_IN_FLIGHT.add(token);

    async function runAutoOnboarding() {
      setAutoOnboarding(true);
      try {
        const onboardRes = await fetch(apiPath("/api/customer/auto-register-from-prefill"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const onboardData = await onboardRes.json().catch(() => ({}));
        if (!onboardRes.ok) {
          const responseEmail = String(onboardData?.email || "").trim().toLowerCase();
          const tokenEmail = extractEmailFromPrefillToken(token);
          const existingEmail = responseEmail || tokenEmail;

          if (onboardRes.status === 409) {
            if (existingEmail) loginForm.setValue("email", existingEmail);
            PREFILL_TOKENS_COMPLETED.add(token);
            setAutoOnboarding(false);
            setSyncing(false);
            const target = existingEmail
              ? `/?email=${encodeURIComponent(existingEmail)}&notice=account-exists`
              : "/?notice=account-exists";
            if (typeof window !== "undefined") {
              window.location.replace(target);
            } else {
              router.replace(target);
            }
            return;
          }

          throw new Error(String(onboardData?.message || "Unable to set up your account."));
        }

        const email = String(onboardData?.email || "").trim().toLowerCase();
        const password = String(onboardData?.password || "");
        if (!email || !password) {
          throw new Error("Missing account credentials.");
        }

        const loginRes = await signIn("credentials", {
          redirect: false,
          authType: "customer",
          email,
          password,
        });
        if (loginRes?.error) {
          throw new Error(loginRes.error);
        }

        setSyncing(true);
        try {
          const syncRes = await fetch(apiPath("/api/acumatica/one-time-sync"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: onboardData?.userId,
              email,
              baid: onboardData?.baid,
            }),
          });
          const syncData = await syncRes.json().catch(() => ({}));
          const allOk =
            syncRes.ok &&
            (Array.isArray(syncData?.results)
              ? syncData.results.every((r: any) => r?.ok === true)
              : true);
          if (!allOk) {
            throw new Error("Sync failed");
          }
          setSyncProgress(100);
          await new Promise((r) => setTimeout(r, 250));
        } finally {
          setSyncing(false);
        }

        router.replace("/");
        router.refresh();
        PREFILL_TOKENS_COMPLETED.add(token);
      } catch (err) {
        PREFILL_TOKENS_IN_FLIGHT.delete(token);
        toast({
          title: "Setup link issue",
          description:
            err instanceof Error && err.message
              ? err.message
              : "This setup link is invalid or expired.",
        });
      } finally {
        PREFILL_TOKENS_IN_FLIGHT.delete(token);
        setAutoOnboarding(false);
      }
    }

    void runAutoOnboarding();
    return;
  }, [prefillToken, toast, router, loginForm, sessionStatus]);

  const onLogin = async (values: LoginValues) => {
    setBusy(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        authType: "customer",
        email: values.email,
        password: values.password,
      });

      if (res?.error) {
        toast({ title: "Login failed", description: res.error });
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const onResendOrderReadyLink = async () => {
    const orderNbr = resendOrderNbr.trim();
    if (!orderNbr) {
      toast({ title: "Enter order number", description: "Order number is required." });
      return;
    }
    if (resendMode === "email" && !resendEmail.trim()) {
      toast({ title: "Enter email", description: "Email is required." });
      return;
    }
    if (resendMode === "phone" && !resendPhone.trim()) {
      toast({ title: "Enter phone", description: "Phone number is required." });
      return;
    }

    setResendSubmitting(true);
    try {
      const payload =
        resendMode === "email"
          ? { orderNbr, email: resendEmail.trim() }
          : { orderNbr, phone: resendPhone };
      await fetch(apiPath("/api/public/order-ready/resend"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast({
        title: "Request received",
        description: "If your information matches, you will receive a link shortly.",
      });
      setShowResend(false);
      setResendOrderNbr("");
      setResendEmail("");
      setResendPhone("");
    } catch {
      toast({
        title: "Unable to send",
        description: "Please try again in a moment.",
      });
    } finally {
      setResendSubmitting(false);
    }
  };

  if (syncing || autoOnboarding) {
    return (
      <FullPageSyncLoader
        progress={syncProgress}
        title={autoOnboarding ? "Setting up your account" : undefined}
        helperText={
          autoOnboarding
            ? "Please leave this window open while we create your account and load your dashboard."
            : undefined
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="text-center mb-6">
        <div className="mx-auto mb-3 flex justify-center">
          <BrandMark size={96} className="opacity-90" />
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">Will Call</h1>
        <p className="text-sm text-muted-foreground mt-2">Sign in to schedule a pickup.</p>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle>Customer Access</CardTitle>
        </CardHeader>
        <CardContent>
          {accountExistsNotice ? (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {accountExistsNotice}
            </p>
          ) : null}

          {resetSuccess ? (
            <p className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              Password updated. Please sign in.
            </p>
          ) : null}

          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" autoComplete="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
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

              <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </Button>
              <div className="text-center">
                <Link href="/forgot-password?type=customer" className="text-xs text-muted-foreground underline">
                  Forgot password
                </Link>
              </div>
            </form>
          </Form>

          <div className="mt-4">
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setShowResend((prev) => !prev)}
            >
              Can't find your pickup link?
            </button>
          </div>

          {showResend ? (
            <div className="mt-4 rounded-lg border border-border/60 bg-white p-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Order number</label>
                <Input
                  value={resendOrderNbr}
                  onChange={(event) => setResendOrderNbr(event.target.value)}
                  placeholder="SO123456"
                />
              </div>

              <RadioGroup
                value={resendMode}
                onValueChange={(value) => setResendMode(value as "email" | "phone")}
                className="grid gap-2"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="email" />
                  Email
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="phone" />
                  Phone
                </label>
              </RadioGroup>

              {resendMode === "email" ? (
                <div>
                  <label className="text-xs text-muted-foreground">Email</label>
                  <Input
                    value={resendEmail}
                    onChange={(event) => setResendEmail(event.target.value)}
                    placeholder="you@example.com"
                    type="email"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground">Phone</label>
                  <PhoneInput value={resendPhone} onChange={setResendPhone} />
                </div>
              )}

              <Button
                type="button"
                variant="hero"
                className="w-full"
                onClick={onResendOrderReadyLink}
                disabled={resendSubmitting}
              >
                {resendSubmitting ? "Sending..." : "Send pickup link"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
