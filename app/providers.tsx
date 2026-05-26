"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { PickupProvider } from "@/context/PickupContext";
import { apiPath } from "@/lib/paths";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      }),
  );

  return (
    <SessionProvider basePath={apiPath("/api/auth")} refetchOnWindowFocus={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <PickupProvider>
            <Toaster />
            <Sonner />
            {children}
          </PickupProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
