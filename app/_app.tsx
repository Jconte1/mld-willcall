// pages/_app.tsx
import type { AppProps } from "next/app";
import "@/app/global.css"
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PickupProvider } from "@/context/PickupContext";

const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PickupProvider>
          <Toaster />
          <Sonner />
          <Component {...pageProps} />
        </PickupProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
