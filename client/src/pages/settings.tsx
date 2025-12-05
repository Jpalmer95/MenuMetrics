import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings as SettingsIcon, Key, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

type AIProvider = "openai" | "gemini" | "grok" | "claude" | "llama" | "mistral" | "deepseek" | "huggingface";

interface AISettings {
  aiProvider?: string | null;
  huggingfaceToken?: string | null;
}

const providerOptions = [
  { value: "openai", label: "OpenAI GPT-5", description: "Latest GPT model for general tasks", replit: true },
  { value: "gemini", label: "Google Gemini 2.5 Flash", description: "Fast and cost-effective", replit: true },
  { value: "claude", label: "Claude Haiku (Anthropic)", description: "Excellent for detailed analysis", replit: true },
  { value: "llama", label: "Llama 3.3 70B (Meta)", description: "Open-source, high quality", replit: true },
  { value: "mistral", label: "Mistral Large", description: "European AI leader", replit: true },
  { value: "grok", label: "Grok (xAI)", description: "xAI's conversational model", replit: true },
  { value: "deepseek", label: "DeepSeek V3", description: "Chinese AI powerhouse", replit: true },
  { value: "huggingface", label: "HuggingFace (Custom)", description: "Bring your own API key", replit: false },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [aiProvider, setAiProvider] = useState<AIProvider>("openai");
  const [huggingfaceToken, setHuggingfaceToken] = useState("");

  const { data: settings, isLoading } = useQuery<AISettings>({
    queryKey: ["/api/settings/ai"],
  });

  useEffect(() => {
    if (settings) {
      setAiProvider((settings.aiProvider as AIProvider) || "openai");
      setHuggingfaceToken(settings.huggingfaceToken || "");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: AISettings) => {
      return await apiRequest("POST", "/api/settings/ai", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/ai"] });
      toast({
        title: "Settings saved",
        description: "Your AI provider settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message || "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      aiProvider,
      huggingfaceToken: huggingfaceToken.trim() || null,
    });
  };

  const isHuggingFace = aiProvider === "huggingface";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your AI provider settings</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>AI Provider Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure API keys for AI providers. Some providers use Replit AI Integrations
            and don't require keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-provider">AI Provider</Label>
              <Select value={aiProvider} onValueChange={(value) => setAiProvider(value as AIProvider)}>
                <SelectTrigger id="ai-provider" data-testid="select-ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isHuggingFace && (
              <Alert>
                <AlertDescription>
                  <strong>{providerOptions.find(p => p.value === aiProvider)?.label}</strong> is powered by Replit AI Integrations.
                  No API key required - charges will be billed to your Replit credits.
                </AlertDescription>
              </Alert>
            )}

            {isHuggingFace && (
              <div className="space-y-2">
                <Label htmlFor="huggingface-token" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  HuggingFace API Token
                </Label>
                <Input
                  id="huggingface-token"
                  type="password"
                  placeholder="hf_..."
                  value={huggingfaceToken}
                  onChange={(e) => setHuggingfaceToken(e.target.value)}
                  data-testid="input-huggingface-token"
                />
                <p className="text-xs text-muted-foreground">
                  Get your free API token from{" "}
                  <a
                    href="https://huggingface.co/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    data-testid="link-huggingface-tokens"
                  >
                    HuggingFace Settings
                  </a>
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-settings"
            >
              {saveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
