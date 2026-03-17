import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Heart } from "lucide-react";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import IngredientsPage from "@/pages/ingredients";
import RecipesPage from "@/pages/recipes";
import RecipeDetailPage from "@/pages/recipe-detail";
import AIAgentPage from "@/pages/ai-agent";
import SettingsPage from "@/pages/settings";
import LandingPage from "@/pages/landing";
import DensitiesPage from "@/pages/densities";
import PricingPlaygroundPage from "@/pages/pricing-playground";
import InventoryCountPage from "@/pages/inventory-count";
import OrdersPage from "@/pages/orders";
import WasteLogPage from "@/pages/waste-log";
import WasteAnalyticsPage from "@/pages/waste-analytics";
import TermsOfServicePage from "@/pages/terms-of-service";
import AdminManagedPricingPage from "@/pages/admin-managed-pricing";
import AdditionsPricingPage from "@/pages/additions-pricing";

function Router({ isAuthenticated, isLoading }: { isAuthenticated: boolean; isLoading: boolean }) {
  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/terms-of-service" component={TermsOfServicePage} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/ingredients" component={IngredientsPage} />
      <Route path="/recipes" component={RecipesPage} />
      <Route path="/recipes/:id" component={RecipeDetailPage} />
      <Route path="/pricing" component={PricingPlaygroundPage} />
      <Route path="/densities" component={DensitiesPage} />
      <Route path="/inventory" component={InventoryCountPage} />
      <Route path="/orders" component={OrdersPage} />
      <Route path="/waste-log" component={WasteLogPage} />
      <Route path="/waste-analytics" component={WasteAnalyticsPage} />
      <Route path="/add-ins" component={AdditionsPricingPage} />
      <Route path="/ai-agent" component={AIAgentPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/terms-of-service" component={TermsOfServicePage} />
      <Route path="/admin/managed-pricing" component={AdminManagedPricingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (!isLoading && !isAuthenticated) {
    return (
      <Router isAuthenticated={false} isLoading={false} />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar userRole={user?.role} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 backdrop-blur-md px-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="-ml-1" />
            <div className="h-4 w-px bg-border" />
            <div className="flex-1" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
              <Router isAuthenticated={isAuthenticated} isLoading={isLoading} />
            </div>
          </main>
          <footer className="border-t border-border/50 bg-background/50 shrink-0">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-muted-foreground">
              <span>Built by Jonathan Korstad, 2025</span>
              <span className="mx-2">·</span>
              <Link href="/terms-of-service" data-testid="link-terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <span className="mx-2">·</span>
              <Link href="/settings?tab=support" data-testid="link-support-dev" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
                <Heart className="h-3 w-3" />
                Support the Developer
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
