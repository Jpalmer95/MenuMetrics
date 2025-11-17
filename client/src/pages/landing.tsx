// REPLIT AUTH INTEGRATION: Landing page for logged-out users
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Coffee, DollarSign, TrendingUp, Sparkles } from "lucide-react";

export default function LandingPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Coffee className="h-12 w-12 text-primary" />
            <h1 className="text-5xl font-bold">MenuMetrics</h1>
          </div>
          
          <p className="text-xl text-muted-foreground mb-8">
            Professional recipe cost analysis for coffee shops and cafes
          </p>

          <div className="flex gap-4 justify-center mb-16">
            <Button size="lg" onClick={handleLogin} data-testid="button-login">
              Log In
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <Card className="p-6">
              <DollarSign className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Track Ingredient Costs</h3>
              <p className="text-sm text-muted-foreground">
                Manage your ingredient inventory with precise cost tracking and automatic unit conversions
              </p>
            </Card>

            <Card className="p-6">
              <TrendingUp className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Calculate COGS</h3>
              <p className="text-sm text-muted-foreground">
                Build recipes and automatically calculate cost per serving and profit margins
              </p>
            </Card>

            <Card className="p-6">
              <Sparkles className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">AI-Powered Insights</h3>
              <p className="text-sm text-muted-foreground">
                Get recipe suggestions and menu pricing strategies from AI
              </p>
            </Card>
          </div>

          <div className="mt-16 text-sm text-muted-foreground">
            <p>Supports email/password, Google, GitHub, and more authentication options</p>
          </div>
        </div>
      </div>
    </div>
  );
}
