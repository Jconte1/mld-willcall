import React from "react";

import BrandMark from "@/components/brand/BrandMark";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Props = {
  progress: number;
};

function getStatus(progress: number) {
  if (progress < 20) return "Getting things ready";
  if (progress < 40) return "Uploading files";
  if (progress < 70) return "Processing";
  return "Finalizing";
}

export default function FullPageSyncLoader({ progress }: Props) {
  const status = getStatus(progress);
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="w-full max-w-md shadow-2xl border-0 animate-slide-up">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex justify-center">
            <BrandMark size={72} className="opacity-90" />
          </div>
          <CardTitle className="font-display text-xl">Syncing your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={pct} className="h-3" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{status}</span>
            <span className="font-medium text-foreground">{pct}%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Please keep this window open while we pull your orders and details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
