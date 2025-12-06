// REPLIT AUTH INTEGRATION
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Coffee, Package, ChefHat, BarChart3, Sparkles, Settings, Menu, LogOut, Beaker, Calculator, ClipboardList, ShoppingCart, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
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

function Router({ isAuthenticated, isLoading }: { isAuthenticated: boolean; isLoading: boolean }) {
  // Show landing page while loading or when not authenticated
  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/terms-of-service" component={TermsOfServicePage} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  // Show protected routes when authenticated
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
      <Route path="/ai-agent" component={AIAgentPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/terms-of-service" component={TermsOfServicePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  const navItems = [
    { path: "/", label: "Dashboard", icon: BarChart3, testId: "link-dashboard" },
    { path: "/ingredients", label: "Ingredients", icon: Package, testId: "link-ingredients" },
    { path: "/recipes", label: "Recipes", icon: ChefHat, testId: "link-recipes" },
    { path: "/pricing", label: "Pricing", icon: Calculator, testId: "link-pricing" },
    { path: "/inventory", label: "Count", icon: ClipboardList, testId: "link-inventory" },
    { path: "/orders", label: "Orders", icon: ShoppingCart, testId: "link-orders" },
    { path: "/waste-log", label: "Waste", icon: Trash2, testId: "link-waste" },
    { path: "/densities", label: "Densities", icon: Beaker, testId: "link-densities" },
    { path: "/ai-agent", label: "Mise AI", icon: Sparkles, testId: "link-ai-agent" },
    { path: "/settings", label: "Settings", icon: Settings, testId: "link-settings" },
  ];

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Only show header when authenticated */}
      {!isLoading && isAuthenticated && (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                  <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center gap-2 hover-elevate rounded-md px-3 py-2" data-testid="link-home">
                      <Coffee className="h-6 w-6 text-primary" />
                      <span className="font-bold text-xl">MenuMetrics</span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-1">
                      {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                        return (
                          <Link key={item.path} href={item.path} data-testid={item.testId}>
                            <div
                              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover-elevate ${
                                isActive
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              {item.label}
                            </div>
                          </Link>
                        );
                      })}
                    </nav>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleLogout}
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Log Out
                    </Button>
                    <ThemeToggle />
                    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                      <SheetTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="md:hidden"
                          data-testid="button-mobile-menu"
                        >
                          <Menu className="h-5 w-5" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right">
                        <SheetHeader>
                          <SheetTitle>Menu</SheetTitle>
                        </SheetHeader>
                        <nav className="flex flex-col gap-2 mt-6">
                          {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                            return (
                              <Link
                                key={item.path}
                                href={item.path}
                                data-testid={`mobile-${item.testId}`}
                                onClick={() => setMobileMenuOpen(false)}
                              >
                                <div
                                  className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors hover-elevate ${
                                    isActive
                                      ? "bg-primary/10 text-primary"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  <Icon className="h-5 w-5" />
                                  {item.label}
                                </div>
                              </Link>
                            );
                          })}
                        </nav>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              </div>
        </header>
      )}

      <main className={!isLoading && isAuthenticated ? "container mx-auto px-4 sm:px-6 lg:px-8 py-8" : ""}>
        <Router isAuthenticated={isAuthenticated} isLoading={isLoading} />
      </main>

      <footer className="border-t bg-background/50 mt-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-muted-foreground" data-testid="text-footer">
          <div className="mb-3">Built by Jonathan Korstad in Replit, 2025</div>
          <div className="flex justify-center gap-4">
            <Link href="/terms-of-service" data-testid="link-terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
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
