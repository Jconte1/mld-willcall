import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PickupProvider } from "@/context/PickupContext";
import Index from "./pages/Index";

const queryClient = new QueryClient();

/**
 * Legacy Vite entry component kept for reference.
 * Next.js uses `app/layout.tsx` + route files under `app/`.
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PickupProvider>
        <Toaster />
        <Sonner />
        <Index />
      </PickupProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
