import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Merchants from "./pages/Merchants";
import Invoices from "./pages/Invoices";
import Statistics from "./pages/Statistics";
import NotFound from "./pages/NotFound";
import Navigation from "./components/Navigation";
import { useRealtimeUpdates, useAutoRefresh, usePeriodicRefresh } from "./hooks/useRealtimeUpdates";

const queryClient = new QueryClient();

// Component to handle realtime updates
const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  useRealtimeUpdates();
  useAutoRefresh();
  usePeriodicRefresh(30000); // Refresh every 30 seconds
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RealtimeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background" dir="rtl">
            <Navigation />
            <main className="lg:mr-64 pt-16 lg:pt-0 pb-24 lg:pb-6 p-4 lg:p-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/merchants" element={<Merchants />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/statistics" element={<Statistics />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </RealtimeProvider>
  </QueryClientProvider>
);

export default App;
