import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Coffee, Package, ChefHat, BarChart3, Sparkles } from "lucide-react";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import IngredientsPage from "@/pages/ingredients";
import RecipesPage from "@/pages/recipes";
import RecipeDetailPage from "@/pages/recipe-detail";
import AIAgentPage from "@/pages/ai-agent";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/ingredients" component={IngredientsPage} />
      <Route path="/recipes" component={RecipesPage} />
      <Route path="/recipes/:id" component={RecipeDetailPage} />
      <Route path="/ai-agent" component={AIAgentPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Dashboard", icon: BarChart3, testId: "link-dashboard" },
    { path: "/ingredients", label: "Ingredients", icon: Package, testId: "link-ingredients" },
    { path: "/recipes", label: "Recipes", icon: ChefHat, testId: "link-recipes" },
    { path: "/ai-agent", label: "AI Agent", icon: Sparkles, testId: "link-ai-agent" },
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                  <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center gap-2 hover-elevate rounded-md px-3 py-2" data-testid="link-home">
                      <Coffee className="h-6 w-6 text-primary" />
                      <span className="font-bold text-xl">Recipe Costing</span>
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
                  <ThemeToggle />
                </div>
              </div>
            </header>

            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Router />
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
