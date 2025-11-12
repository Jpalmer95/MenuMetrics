import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, DollarSign, Lightbulb } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type AIProvider = "openai" | "gemini" | "grok" | "huggingface";

export default function AIAgentPage() {
  const [provider, setProvider] = useState<AIProvider>("openai");
  const [customApiKey, setCustomApiKey] = useState("");
  const [recipeIdeas, setRecipeIdeas] = useState<string>("");
  const [menuStrategy, setMenuStrategy] = useState<string>("");
  const { toast } = useToast();

  const recipeIdeasMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/recipe-ideas", {
        provider,
        customApiKey: provider === "huggingface" ? customApiKey : undefined,
      });
      const data = await response.json();
      return data.response;
    },
    onSuccess: (data) => {
      setRecipeIdeas(data);
      toast({
        title: "Recipe Ideas Generated",
        description: "AI has suggested cost-effective recipes based on your ingredients.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate recipe ideas",
        variant: "destructive",
      });
    },
  });

  const menuStrategyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/menu-strategy", {
        provider,
        customApiKey: provider === "huggingface" ? customApiKey : undefined,
      });
      const data = await response.json();
      return data.response;
    },
    onSuccess: (data) => {
      setMenuStrategy(data);
      toast({
        title: "Menu Strategy Generated",
        description: "AI has analyzed your menu and provided pricing recommendations.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate menu strategy",
        variant: "destructive",
      });
    },
  });

  const isHuggingFace = provider === "huggingface";
  const needsApiKey = isHuggingFace && !customApiKey;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Recipe Agent</h1>
        <p className="text-muted-foreground mt-2">
          Use AI to discover cost-efficient recipes and optimize your menu pricing strategy
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Provider Settings</CardTitle>
          <CardDescription>
            Choose your preferred AI provider. OpenAI, Gemini, and Grok use Replit AI Integrations (no API key required, charges billed to your credits).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-select">AI Provider</Label>
            <Select value={provider} onValueChange={(value) => setProvider(value as AIProvider)}>
              <SelectTrigger id="provider-select" data-testid="select-ai-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (GPT-5) - Replit AI Integrations</SelectItem>
                <SelectItem value="gemini">Google Gemini (2.5 Flash) - Replit AI Integrations</SelectItem>
                <SelectItem value="grok">Grok (xAI) - Replit AI Integrations</SelectItem>
                <SelectItem value="huggingface">HuggingFace (Llama 3.3 70B) - Custom API Key</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isHuggingFace && (
            <div className="space-y-2">
              <Label htmlFor="api-key-input">HuggingFace Access Token</Label>
              <Input
                id="api-key-input"
                type="password"
                placeholder="hf_..."
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                data-testid="input-huggingface-token"
              />
              <p className="text-sm text-muted-foreground">
                Get your free API token from{" "}
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  huggingface.co/settings/tokens
                </a>
              </p>
            </div>
          )}

          {!isHuggingFace && (
            <Alert>
              <AlertDescription>
                <strong>{provider === "openai" ? "OpenAI" : provider === "gemini" ? "Gemini" : "Grok"}</strong> is powered by Replit AI Integrations.
                No API key required - charges will be billed to your Replit credits.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Recipe Ideas
            </CardTitle>
            <CardDescription>
              Get AI-generated recipe suggestions based on your current ingredients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => recipeIdeasMutation.mutate()}
              disabled={recipeIdeasMutation.isPending || needsApiKey}
              className="w-full"
              data-testid="button-generate-recipes"
            >
              {recipeIdeasMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Recipe Ideas
                </>
              )}
            </Button>

            {recipeIdeas && (
              <div className="rounded-md border p-4 bg-card">
                <pre className="whitespace-pre-wrap text-sm font-mono text-foreground" data-testid="text-recipe-ideas">
                  {recipeIdeas}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Menu Strategy
            </CardTitle>
            <CardDescription>
              Get AI-powered pricing recommendations and profitability analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => menuStrategyMutation.mutate()}
              disabled={menuStrategyMutation.isPending || needsApiKey}
              className="w-full"
              data-testid="button-generate-strategy"
            >
              {menuStrategyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Analyze Menu Strategy
                </>
              )}
            </Button>

            {menuStrategy && (
              <div className="rounded-md border p-4 bg-card">
                <pre className="whitespace-pre-wrap text-sm font-mono text-foreground" data-testid="text-menu-strategy">
                  {menuStrategy}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
