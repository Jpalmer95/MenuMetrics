import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings as SettingsIcon, Key, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AISettings {
  huggingfaceToken?: string | null;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [huggingfaceToken, setHuggingfaceToken] = useState("");

  const { data: settings, isLoading } = useQuery<AISettings>({
    queryKey: ["/api/settings/ai"],
  });

  useEffect(() => {
    if (settings) {
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
      huggingfaceToken: huggingfaceToken || undefined,
    });
  };

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
              <h3 className="text-sm font-medium">Providers Using Replit AI Integrations</h3>
              <p className="text-sm text-muted-foreground">
                The following providers are integrated through Replit and don't require API keys.
                Usage is billed to your Replit credits:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>OpenAI (GPT-5)</li>
                <li>Google Gemini (2.5 Flash)</li>
                <li>Grok (xAI via OpenRouter)</li>
              </ul>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-4">Custom API Keys</h3>
              
              <div className="space-y-4">
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
                    Get your API token from{" "}
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
              </div>
            </div>
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
