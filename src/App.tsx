import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import GlobalSentiment from "./pages/GlobalSentiment";
import MarketCorrelation from "./pages/MarketCorrelation";
import CompanySearch from "./pages/CompanySearch";
import SentimentFactors from "./pages/SentimentFactors";
import PredictionAccuracy from "./pages/PredictionAccuracy";
import NotFound from "./pages/NotFound";
import { NavLink } from "./components/NavLink";
import { ThemeToggle } from "./components/ThemeToggle";
import { TrendingUp, Globe, Activity, Search, Target, BarChart3, Menu, X, Percent } from "lucide-react";
import { useState } from "react";
import { cn } from "./lib/utils";

const queryClient = new QueryClient();

const navItems = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/global-sentiment", label: "Global Sentiment", icon: Globe },
  { to: "/market-correlation", label: "Market Impact", icon: Activity },
  { to: "/company-search", label: "Company Search", icon: Search },
  { to: "/sentiment-factors", label: "India Factors", icon: Target },
  { to: "/prediction-accuracy", label: "Accuracy", icon: Percent },
];

function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center glow-sm">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold gradient-text">StockSentiment</h1>
              <p className="text-xs text-muted-foreground -mt-0.5">Analytics Platform</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-muted"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="lg:hidden py-4 border-t animate-fade-in">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="min-h-screen bg-background bg-gradient-mesh">
          <Navigation />
          <main className="animate-fade-in">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/global-sentiment" element={<GlobalSentiment />} />
              <Route path="/market-correlation" element={<MarketCorrelation />} />
              <Route path="/company-search" element={<CompanySearch />} />
              <Route path="/sentiment-factors" element={<SentimentFactors />} />
              <Route path="/prediction-accuracy" element={<PredictionAccuracy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
