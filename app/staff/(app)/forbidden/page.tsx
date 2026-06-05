"use client";
import { withPublicBasePath } from "@/lib/publicPath";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StaffForbiddenPage() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          403 Forbidden
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You don't have permission to access this page.
        </p>
        <Button asChild variant="secondary">
          <Link href={withPublicBasePath("/staff")}>Go to Staff Home</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
