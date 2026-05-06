"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function CustomerSetupPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const user = session?.user as any;

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (user?.type !== "customer") {
      router.replace("/");
      return;
    }
    if (!user?.mustChangePassword && !user?.mustCompleteProfile) {
      router.replace("/");
      return;
    }
    if (user?.name && user.name !== "Complete Profile") {
      setName(String(user.name));
    }
  }, [status, user, router]);

  const onSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter your full name." });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters." });
      return;
    }
    if (!/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      toast({
        title: "Password requirements",
        description: "Password must include at least 1 number and 1 symbol.",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/customer/complete-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Setup failed",
          description: data?.message || "Unable to complete account setup.",
        });
        return;
      }

      await update({
        user: {
          name: name.trim(),
          mustChangePassword: false,
          mustCompleteProfile: false,
        } as any,
      });

      const relog = await signIn("credentials", {
        redirect: false,
        authType: "customer",
        email: user?.email,
        password,
      });

      if (relog?.error) {
        toast({
          title: "Password updated",
          description: "Please sign in with your new password.",
        });
        router.replace("/");
        return;
      }

      router.replace("/");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-10">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Account Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                One-time setup required before you can use your dashboard.
              </p>
              <div>
                <label className="text-sm font-medium">Full name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label className="text-sm font-medium">New password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Confirm new password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
              </div>
              <Button className="w-full" variant="hero" onClick={onSubmit} disabled={submitting}>
                {submitting ? "Saving..." : "Save and Continue"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

