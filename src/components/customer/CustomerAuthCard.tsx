"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";

import BrandMark from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PhoneInput from "@/components/system/PhoneInput";
import FullPageSyncLoader from "@/components/system/FullPageSyncLoader";
import { useToast } from "@/hooks/use-toast";

const BAID_REGEX = /^BA\d{7}$/i;

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z
  .object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Enter a valid email"),
    phone: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v.length === 10, { message: "Enter a 10-digit phone number" }),
    zip: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v.length === 5, { message: "Enter a 5-digit ZIP code" }),
    baid: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => BAID_REGEX.test(v), { message: "Customer ID# must be BA + 7 digits" }),
    inviteCode: z.string().min(6, "Invite code is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

type VerifyState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "verified"; baid: string }
  | { status: "failed"; message: string };

function normalizeBaid(value: string) {
  return value.trim().toUpperCase();
}

function normalizeZip(value: string) {
  return value.replace(/\D/g, "").slice(0, 5);
}

function getLockKey(baid: string) {
  return `willcall:baidVerify:${baid}:lockUntil`;
}

function getAttemptsKey(baid: string) {
  return `willcall:baidVerify:${baid}:attempts`;
}

function nowMs() {
  return Date.now();
}

export default function CustomerAuthCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"login" | "register">("login");
  const [busy, setBusy] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState(0);
  const [requestingInvite, setRequestingInvite] = React.useState(false);
  const [showResend, setShowResend] = React.useState(false);
  const [resendMode, setResendMode] = React.useState<"email" | "phone">("email");
  const [resendOrderNbr, setResendOrderNbr] = React.useState("");
  const [resendEmail, setResendEmail] = React.useState("");
  const [resendPhone, setResendPhone] = React.useState("");
  const [resendSubmitting, setResendSubmitting] = React.useState(false);
  const [showInviteModal, setShowInviteModal] = React.useState(false);
  const resetSuccess = searchParams.get("reset") === "success";

  const [verifyState, setVerifyState] = React.useState<VerifyState>({ status: "idle" });
  const [lockedUntil, setLockedUntil] = React.useState<number>(0);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      zip: "",
      baid: "",
      inviteCode: "",
      password: "",
      confirmPassword: "",
    },
  });

  const watchedBaid = registerForm.watch("baid");
  const watchedZip = registerForm.watch("zip");
  const normalizedBaid = React.useMemo(() => normalizeBaid(watchedBaid || ""), [watchedBaid]);
  const baidLooksValid = React.useMemo(() => BAID_REGEX.test(normalizedBaid), [normalizedBaid]);
  const normalizedZip = React.useMemo(() => normalizeZip(watchedZip || ""), [watchedZip]);
  const zipLooksValid = React.useMemo(() => normalizedZip.length === 5, [normalizedZip]);

  // If the BAID changes, clear prior verification.
  React.useEffect(() => {
    if (verifyState.status === "verified" && verifyState.baid !== normalizedBaid) {
      setVerifyState({ status: "idle" });
    }

    // Pull lock state for this BAID (per-device UX limiter).
    if (!normalizedBaid) {
      setLockedUntil(0);
      return;
    }

    try {
      const raw = window.localStorage.getItem(getLockKey(normalizedBaid));
      const until = raw ? Number(raw) : 0;
      setLockedUntil(Number.isFinite(until) ? until : 0);
    } catch {
      // ignore
    }
  }, [normalizedBaid, verifyState, normalizedZip]);

  const isLocked = lockedUntil > 0 && nowMs() < lockedUntil;

  React.useEffect(() => {
    if (!syncing) return;
    setSyncProgress(0);
    const interval = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 92) return prev;
        const bump = 3 + Math.random() * 6;
        return Math.min(92, prev + bump);
      });
    }, 600);

    return () => clearInterval(interval);
  }, [syncing]);

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

  const onVerifyBaid = async () => {
    const baid = normalizeBaid(registerForm.getValues("baid"));
    const zip = normalizeZip(registerForm.getValues("zip"));

    if (!BAID_REGEX.test(baid)) {
      setVerifyState({
        status: "failed",
        message:
          "We couldn't confirm your Customer ID#, ZIP code, or invite code. Please contact your salesperson.",
      });
      return false;
    }

    if (zip.length !== 5) {
      setVerifyState({
        status: "failed",
        message:
          "We couldn't confirm your Customer ID#, ZIP code, or invite code. Please contact your salesperson.",
      });
      return false;
    }

    if (isLocked) {
      setVerifyState({ status: "failed", message: "Too many attempts. Please try again later." });
      return false;
    }

    setVerifyState({ status: "verifying" });

    try {
      const res = await fetch("/api/customer/verify-baid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baid, zip }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok !== true) {
        // attempt tracking (client-side)
        try {
          const prev = Number(window.localStorage.getItem(getAttemptsKey(baid)) ?? "0");
          const next = Math.min(3, prev + 1);
          window.localStorage.setItem(getAttemptsKey(baid), String(next));

          if (next >= 3) {
            const until = nowMs() + 60 * 60 * 1000; // 1 hour
            window.localStorage.setItem(getLockKey(baid), String(until));
            setLockedUntil(until);
          }
        } catch {
          // ignore
        }

        setVerifyState({
          status: "failed",
          message:
            "We couldn't confirm your Customer ID#, ZIP code, or invite code. Please contact your salesperson.",
        });
        return false;
      }

      // success -> clear attempts + lock
      try {
        window.localStorage.removeItem(getAttemptsKey(baid));
        window.localStorage.removeItem(getLockKey(baid));
      } catch {
        // ignore
      }

      setLockedUntil(0);
      setVerifyState({ status: "verified", baid });
      return true;
    } catch {
      setVerifyState({ status: "failed", message: "Unable to verify right now. Please try again." });
      return false;
    }
  };

  const onRegister = async (values: RegisterValues) => {
    const baid = normalizeBaid(values.baid);
    const zip = normalizeZip(values.zip);

    setBusy(true);
    try {
      if (isLocked) {
        setVerifyState({
          status: "failed",
          message: "Too many attempts. Please try again later.",
        });
        toast({
          title: "Unable to verify",
          description: "Too many attempts. Please try again later.",
        });
        return;
      }

      setVerifyState({ status: "verifying" });
      const verified = await onVerifyBaid();
      if (!verified) {
        toast({
          title: "Unable to verify",
          description:
            "We couldn't confirm your Customer ID#, ZIP code, or invite code. Please contact your salesperson.",
        });
        return;
      }

      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          phone: values.phone,
          baid: baid,
          zip,
          inviteCode: values.inviteCode,
          password: values.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast({
          title: "Registration failed",
          description:
            "We couldn't confirm your Customer ID#, ZIP code, or invite code. Please contact your salesperson.",
        });
        return;
      }

      setSyncing(true);
      try {
        const syncRes = await fetch("/api/acumatica/one-time-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: data?.user?.id,
            email: values.email,
            baid,
          }),
        });

        const syncData = await syncRes.json().catch(() => ({}));
        const allOk =
          syncRes.ok &&
          (Array.isArray(syncData?.results)
            ? syncData.results.every((r: any) => r?.ok === true)
            : true);

        if (!allOk) {
          toast({
            title: "Sync failed",
            description: "We couldn't finish syncing your orders. Please try again.",
          });
          return;
        }

        setSyncProgress(100);
        await new Promise((r) => setTimeout(r, 300));
      } catch {
        toast({
          title: "Sync failed",
          description: "We couldn't finish syncing your orders. Please try again.",
        });
        return;
      } finally {
        setSyncing(false);
      }

      // auto-login after success
      const loginRes = await signIn("credentials", {
        redirect: false,
        authType: "customer",
        email: values.email,
        password: values.password,
      });

      if (loginRes?.error) {
        toast({ title: "Account created", description: "Please sign in to continue." });
        setTab("login");
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
      const res = await fetch("/api/public/order-ready/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await res.json().catch(() => ({}));
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

  const onRequestInvite = async () => {
    const baid = normalizeBaid(registerForm.getValues("baid"));
    const zip = normalizeZip(registerForm.getValues("zip"));

    if (!BAID_REGEX.test(baid)) {
      toast({ title: "Check Customer ID#", description: "Enter a valid Customer ID# to request a new code." });
      return;
    }
    if (zip.length !== 5) {
      toast({ title: "Check ZIP", description: "Enter your 5-digit billing ZIP code." });
      return;
    }

    setRequestingInvite(true);
    try {
      const res = await fetch("/api/customer/invites/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baid, zip }),
      });
      const data = await res.json().catch(() => ({}));

      if (data?.status === "locked") {
        toast({
          title: "Too many attempts",
          description: "Please call 801-466-0990 ext. 3 for assistance.",
        });
        return;
      }

      if (data?.status === "admin-required") {
        toast({
          title: "Contact your admin",
          description: "Please ask your account administrator to send you an invite.",
        });
        return;
      }

      toast({
        title: "Invite sent",
        description: "If your details match, you'll receive a code shortly.",
      });
    } catch {
      toast({
        title: "Unable to send",
        description: "Please try again or contact support.",
      });
    } finally {
      setRequestingInvite(false);
    }
  };

  const verifyUi = (() => {
    if (verifyState.status === "verifying") {
      return (
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verifying...
        </span>
      );
    }

    if (verifyState.status === "verified") {
      return (
        <span className="inline-flex items-center gap-2 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Verified
        </span>
      );
    }

    if (verifyState.status === "failed") {
      return <span className="text-sm text-destructive">{verifyState.message}</span>;
    }

    if (isLocked) {
      return <span className="text-sm text-destructive">Too many attempts. Try again later.</span>;
    }

    return null;
  })();

  return (
    <div className="mx-auto w-full max-w-md">
      {syncing ? <FullPageSyncLoader progress={syncProgress} /> : null}
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
          {resetSuccess ? (
            <p className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              Password updated. Please sign in.
            </p>
          ) : null}
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
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

                  <Button type="button" variant="hero" className="w-full" onClick={onResendOrderReadyLink} disabled={resendSubmitting}>
                    {resendSubmitting ? "Sending..." : "Send pickup link"}
                  </Button>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Full Name" autoComplete="name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="Email Address" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <PhoneInput aria-label="Phone number" value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  

                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="baid"
                    render={({ field }) => (
                      <FormItem>
                            <FormLabel>Customer ID#</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Customer ID#"
                                autoComplete="off"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                  if (verifyState.status !== "idle") setVerifyState({ status: "idle" });
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                  <FormField
                    control={registerForm.control}
                    name="zip"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-end justify-between gap-3">
                          <div className="flex-1">
                            <FormLabel>Billing ZIP code</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Billing ZIP Code"
                                inputMode="numeric"
                                autoComplete="postal-code"
                                maxLength={5}
                                {...field}
                                onChange={(e) => {
                                  const next = normalizeZip(e.target.value);
                                  field.onChange(next);
                                  if (verifyState.status !== "idle") setVerifyState({ status: "idle" });
                                }}
                              />
                            </FormControl>
                          </div>

                        </div>

                        <p className="text-xs text-muted-foreground">
                          Your Customer ID# is provided to you by MLD. We'll verify it when you create your account.
                        </p>

                        <div className="min-h-[20px]">{verifyUi}</div>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="inviteCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invite Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Invite Code"
                            autoComplete="off"
                            maxLength={12}
                            {...field}
                          />
                        </FormControl>
                        <div className="mt-2">
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setShowInviteModal(true)}
                          >
                            Get a new code
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    variant="hero"
                    className="w-full"
                    disabled={busy}
                  >
                    {busy ? "Creating account..." : "Create account"}
                  </Button>

                </form>
              </Form>

              {showInviteModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                  <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
                    <div className="text-sm font-semibold text-foreground">Request a new invite code</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter your Customer ID# and billing ZIP to request a new code.
                    </p>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Customer ID#</label>
                        <Input
                          value={registerForm.getValues("baid")}
                          onChange={(event) => {
                            registerForm.setValue("baid", event.target.value);
                            if (verifyState.status !== "idle") setVerifyState({ status: "idle" });
                          }}
                          placeholder="Customer ID#"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Billing ZIP</label>
                        <Input
                          value={registerForm.getValues("zip")}
                          onChange={(event) => {
                            const next = normalizeZip(event.target.value);
                            registerForm.setValue("zip", next);
                            if (verifyState.status !== "idle") setVerifyState({ status: "idle" });
                          }}
                          placeholder="Billing ZIP Code"
                          inputMode="numeric"
                          autoComplete="postal-code"
                          maxLength={5}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowInviteModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="hero"
                        onClick={async () => {
                          await onRequestInvite();
                          setShowInviteModal(false);
                        }}
                        disabled={requestingInvite || !baidLooksValid || !zipLooksValid}
                      >
                        {requestingInvite ? "Sending..." : "Get new code"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
