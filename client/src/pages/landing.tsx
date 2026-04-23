import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coffee, DollarSign, TrendingUp, Sparkles, Loader2 } from "lucide-react";

export default function LandingPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: any = { email, password };
      if (mode === "register") {
        body.firstName = firstName;
        body.lastName = lastName;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Authentication failed");
        setLoading(false);
        return;
      }

      // Reload to enter the app
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
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

          <Card className="max-w-md mx-auto p-6 mb-16 text-left">
            <h2 className="text-2xl font-bold mb-4 text-center">
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
              {mode === "register" && (
                <>
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                </>
              )}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" ? "Log In" : "Create Account"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              {mode === "login" ? (
                <span>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className="text-primary hover:underline"
                  >
                    Sign up
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-primary hover:underline"
                  >
                    Log in
                  </button>
                </span>
              )}
            </div>
          </Card>

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
        </div>
      </div>
    </div>
  );
}
