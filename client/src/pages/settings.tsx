import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings as SettingsIcon, Key, Sparkles, CreditCard, Zap, Check, Crown, ExternalLink, AlertTriangle, DollarSign, Users, Package, Phone, FileText, X, RefreshCw, Download, Upload, Database, FileJson } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type AIProvider = "openai" | "gemini" | "grok" | "claude" | "llama" | "mistral" | "deepseek" | "huggingface" | "ollama";

interface AISettings {
  aiProvider?: string | null;
  huggingfaceToken?: string | null;
  ollamaUrl?: string | null;
  ollamaModel?: string | null;
}

interface SubscriptionStatus {
  tier: string;
  tierName: string;
  status: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  aiUsage: {
    used: number;
    limit: number;
    remaining: number;
  };
}

interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  aiQueriesPerMonth: number;
  priceId: string | null;
}

interface ManagedPricingTier {
  name: string;
  maxItems: number | null;
  priceMonthly: number;
  description: string;
}

interface ManagedPricingSubscription {
  id: string;
  tier: string;
  status: string;
  businessName: string | null;
  contactPhone: string | null;
  specialNotes: string | null;
  lastServiceDate: string | null;
  nextScheduledDate: string | null;
  createdAt: string;
  tierDetails: ManagedPricingTier;
  itemCount: number;
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
  { value: "ollama", label: "Ollama (Local)", description: "Run AI models on your own machine", replit: false },
];

function AISettingsTab() {
  const { toast } = useToast();
  const [aiProvider, setAiProvider] = useState<AIProvider>("openai");
  const [huggingfaceToken, setHuggingfaceToken] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery<AISettings>({
    queryKey: ["/api/settings/ai"],
  });

  useEffect(() => {
    if (settings) {
      setAiProvider((settings.aiProvider as AIProvider) || "openai");
      setHuggingfaceToken(settings.huggingfaceToken || "");
      setOllamaUrl(settings.ollamaUrl || "http://localhost:11434");
      setOllamaModel(settings.ollamaModel || "");
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
      ollamaUrl: ollamaUrl.trim() || null,
      ollamaModel: ollamaModel.trim() || null,
    });
  };

  const testOllamaConnection = async () => {
    setConnectionStatus("testing");
    setConnectionError(null);
    try {
      const response = await apiRequest("POST", "/api/settings/ai/test-ollama", {
        url: ollamaUrl.trim(),
        model: ollamaModel.trim() || undefined,
      });
      const result = await response.json();
      if (result.success) {
        setConnectionStatus("success");
        setOllamaModels(result.models || []);
        toast({
          title: "Connection successful",
          description: result.models?.length 
            ? `Found ${result.models.length} models available` 
            : "Connected to Ollama server",
        });
      } else {
        setConnectionStatus("error");
        setConnectionError(result.error || "Connection failed");
        setOllamaModels(result.models || []);
      }
    } catch (error: any) {
      setConnectionStatus("error");
      setConnectionError(error.message || "Failed to connect to Ollama");
    }
  };

  const isHuggingFace = aiProvider === "huggingface";
  const isOllama = aiProvider === "ollama";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
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

          {!isHuggingFace && !isOllama && (
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

          {isOllama && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Connect to your locally running Ollama server. Make sure Ollama is installed and running on your machine.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="ollama-url" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Ollama Server URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="ollama-url"
                    type="text"
                    placeholder="http://localhost:11434"
                    value={ollamaUrl}
                    onChange={(e) => {
                      setOllamaUrl(e.target.value);
                      setConnectionStatus("idle");
                      setOllamaModels([]);
                    }}
                    data-testid="input-ollama-url"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={testOllamaConnection}
                    disabled={connectionStatus === "testing" || !ollamaUrl.trim()}
                    data-testid="button-test-ollama"
                  >
                    {connectionStatus === "testing" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : connectionStatus === "success" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">Test</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Default: http://localhost:11434. Change if your Ollama is running on a different address.
                </p>
              </div>

              {connectionStatus === "error" && connectionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}

              {connectionStatus === "success" && ollamaModels.length > 0 && (
                <Alert>
                  <Check className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    Connected! Available models: {ollamaModels.slice(0, 5).join(", ")}
                    {ollamaModels.length > 5 && ` and ${ollamaModels.length - 5} more`}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="ollama-model" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Model Name
                </Label>
                {ollamaModels.length > 0 ? (
                  <Select value={ollamaModel} onValueChange={setOllamaModel}>
                    <SelectTrigger id="ollama-model" data-testid="select-ollama-model">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {ollamaModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="ollama-model"
                    type="text"
                    placeholder="llama3, mistral, codellama..."
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    data-testid="input-ollama-model"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Enter the name of the model you want to use. Test connection to see available models.
                </p>
              </div>
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
  );
}

function BillingTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: subscription, isLoading: subscriptionLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/billing/subscription"],
  });

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/billing/plans"],
  });

  const startTrialMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/billing/start-trial", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      toast({
        title: "Free trial started",
        description: "You now have access to AI features for 7 days!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error starting trial",
        description: error.message || "Failed to start trial. Please try again.",
        variant: "destructive",
      });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ priceId, tier }: { priceId: string; tier: string }) => {
      const response = await apiRequest("POST", "/api/billing/create-checkout-session", { priceId, tier });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/billing/create-portal-session", {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (subscriptionLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isActive = subscription?.status === 'active';
  const isTrialing = subscription?.status === 'trialing';
  const isFree = subscription?.tier === 'free';
  const canStartTrial = isFree && !subscription?.trialEndsAt;
  const usagePercent = subscription?.aiUsage.limit ? (subscription.aiUsage.used / subscription.aiUsage.limit) * 100 : 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <CardTitle>Current Plan</CardTitle>
            </div>
            <Badge variant={isActive || isTrialing ? "default" : "secondary"}>
              {subscription?.tierName || 'Free'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isTrialing && subscription?.trialEndsAt && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your free trial ends on {formatDate(subscription.trialEndsAt)}. Upgrade now to keep using AI features.
              </AlertDescription>
            </Alert>
          )}

          {subscription?.status === 'past_due' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your payment is past due. Please update your payment method to continue using AI features.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">AI Queries Used</span>
              <span className="font-medium">
                {subscription?.aiUsage.used || 0} / {subscription?.aiUsage.limit || 0}
              </span>
            </div>
            <Progress value={usagePercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {subscription?.aiUsage.remaining || 0} queries remaining this month
            </p>
          </div>

          {(isActive || isTrialing) && subscription?.currentPeriodEnd && (
            <p className="text-sm text-muted-foreground">
              {isTrialing ? 'Trial ends' : 'Next billing date'}: {formatDate(subscription.currentPeriodEnd || subscription.trialEndsAt)}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          {canStartTrial && (
            <Button
              onClick={() => startTrialMutation.mutate()}
              disabled={startTrialMutation.isPending}
              data-testid="button-start-trial"
            >
              {startTrialMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Zap className="mr-2 h-4 w-4" />
              Start Free Trial
            </Button>
          )}
          {(isActive || subscription?.tier !== 'free') && (
            <Button
              variant="outline"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              data-testid="button-manage-billing"
            >
              {portalMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ExternalLink className="mr-2 h-4 w-4" />
              Manage Billing
            </Button>
          )}
        </CardFooter>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {plans?.map((plan) => {
            const isCurrentPlan = subscription?.tier === plan.id;
            const price = plan.priceMonthly / 100;
            
            return (
              <Card key={plan.id} className={isCurrentPlan ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {isCurrentPlan && <Badge variant="secondary">Current</Badge>}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{plan.aiQueriesPerMonth} AI queries/month</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Recipe cost analysis</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Menu optimization</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Business insights</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? "secondary" : "default"}
                    disabled={isCurrentPlan || !plan.priceId || checkoutMutation.isPending}
                    onClick={() => plan.priceId && checkoutMutation.mutate({ priceId: plan.priceId, tier: plan.id })}
                    data-testid={`button-subscribe-${plan.id}`}
                  >
                    {checkoutMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isCurrentPlan ? "Current Plan" : !plan.priceId ? "Coming Soon" : "Subscribe"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <ManagedPricingSection />
    </div>
  );
}

interface StripePriceInfo {
  priceId: string;
  amount: number;
}

function ManagedPricingSection() {
  const { toast } = useToast();
  const [showBusinessForm, setShowBusinessForm] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const { data: tiers, isLoading: tiersLoading } = useQuery<Record<string, ManagedPricingTier>>({
    queryKey: ["/api/managed-pricing/tiers"],
  });

  const { data: subscription, isLoading: subLoading } = useQuery<ManagedPricingSubscription | null>({
    queryKey: ["/api/managed-pricing"],
  });

  const { data: stripePrices, isLoading: pricesLoading } = useQuery<Record<string, StripePriceInfo>>({
    queryKey: ["/api/managed-pricing/prices"],
  });

  // Sync form state from subscription when it changes (not during mutations)
  useEffect(() => {
    if (subscription && subscription.status === "active") {
      setBusinessName(subscription.businessName || "");
      setContactPhone(subscription.contactPhone || "");
      setSpecialNotes(subscription.specialNotes || "");
    }
  }, [subscription]);

  const checkoutMutation = useMutation({
    mutationFn: async (data: { tier: string; businessName?: string; contactPhone?: string; specialNotes?: string }) => {
      const response = await apiRequest("POST", "/api/managed-pricing/create-checkout", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: "Failed to create checkout session. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { tier?: string; businessName?: string; contactPhone?: string; specialNotes?: string }) => {
      return await apiRequest("PATCH", "/api/managed-pricing", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/managed-pricing"] });
      // Optimistically update selected tier to prevent stale display
      if (variables.tier) {
        setSelectedTier(variables.tier);
        toast({
          title: "Tier Changed",
          description: "Your subscription tier has been updated.",
        });
      } else {
        toast({
          title: "Updated",
          description: "Your managed pricing details have been updated.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update. Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/managed-pricing");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managed-pricing"] });
      toast({
        title: "Subscription Canceled",
        description: "Your managed pricing subscription has been canceled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (tiersLoading || subLoading || pricesLoading) {
    return (
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Managed Pricing Service
        </h3>
        <div className="flex items-center justify-center min-h-[100px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const hasActiveSubscription = subscription && subscription.status === "active";
  const isCanceled = subscription && subscription.status === "canceled";
  const tierEntries = tiers ? Object.entries(tiers) : [];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleSubscribe = (tier: string) => {
    setSelectedTier(tier);
    // For reactivation of canceled subscription, go directly to checkout
    if (isCanceled && subscription?.tier === tier) {
      checkoutMutation.mutate({
        tier,
        businessName: businessName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        specialNotes: specialNotes.trim() || undefined,
      });
    } else {
      setShowBusinessForm(true);
    }
  };

  const handleConfirmSubscribe = () => {
    if (!selectedTier) return;
    checkoutMutation.mutate({
      tier: selectedTier,
      businessName: businessName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      specialNotes: specialNotes.trim() || undefined,
    });
  };

  const handleCancelForm = () => {
    setShowBusinessForm(false);
    setSelectedTier(null);
  };

  const handleUpdateDetails = () => {
    updateMutation.mutate({
      businessName: businessName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      specialNotes: specialNotes.trim() || undefined,
    });
  };

  const handleChangeTier = (newTier: string) => {
    if (newTier === subscription?.tier) return;
    updateMutation.mutate({ tier: newTier });
  };

  return (
    <div className="mt-8 border-t pt-8">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <DollarSign className="h-5 w-5" />
        Managed Pricing Service
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Let our experts manage your ingredient pricing and keep your costs optimized.
      </p>

      {hasActiveSubscription && subscription && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                <CardTitle className="text-lg">Active: {subscription.tierDetails.name}</CardTitle>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            <CardDescription>{subscription.tierDetails.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Your Items:</span>
                <span className="ml-2 font-medium">
                  {subscription.itemCount} / {subscription.tierDetails.maxItems || "Unlimited"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Price:</span>
                <span className="ml-2 font-medium">${(subscription.tierDetails.priceMonthly / 100).toFixed(2)}/mo</span>
              </div>
              {subscription.lastServiceDate && (
                <div>
                  <span className="text-muted-foreground">Last Update:</span>
                  <span className="ml-2 font-medium">{formatDate(subscription.lastServiceDate)}</span>
                </div>
              )}
              {subscription.nextScheduledDate && (
                <div>
                  <span className="text-muted-foreground">Next Update:</span>
                  <span className="ml-2 font-medium">{formatDate(subscription.nextScheduledDate)}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="mp-business-name" className="flex items-center gap-1 text-sm">
                  <Users className="h-3 w-3" />
                  Business Name
                </Label>
                <Input
                  id="mp-business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your business name"
                  data-testid="input-mp-business-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mp-phone" className="flex items-center gap-1 text-sm">
                  <Phone className="h-3 w-3" />
                  Contact Phone
                </Label>
                <Input
                  id="mp-phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  data-testid="input-mp-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mp-notes" className="flex items-center gap-1 text-sm">
                  <FileText className="h-3 w-3" />
                  Special Notes
                </Label>
                <Textarea
                  id="mp-notes"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="Any special requirements or notes for our team..."
                  className="resize-none"
                  rows={2}
                  data-testid="input-mp-notes"
                />
              </div>
              <Button
                onClick={handleUpdateDetails}
                disabled={updateMutation.isPending}
                size="sm"
                data-testid="button-update-mp-details"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Details
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between flex-wrap gap-2">
            <Select value={subscription.tier} onValueChange={handleChangeTier}>
              <SelectTrigger className="w-[200px]" data-testid="select-mp-tier">
                <SelectValue placeholder="Change tier" />
              </SelectTrigger>
              <SelectContent>
                {tierEntries.map(([key, tier]) => (
                  <SelectItem key={key} value={key}>
                    {tier.name} - ${(tier.priceMonthly / 100).toFixed(0)}/mo
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              data-testid="button-cancel-mp"
            >
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <X className="mr-2 h-4 w-4" />
              Cancel Service
            </Button>
          </CardFooter>
        </Card>
      )}

      {isCanceled && subscription && (
        <Alert className="mb-4">
          <RefreshCw className="h-4 w-4" />
          <AlertDescription>
            Your managed pricing subscription was canceled. You can reactivate it below.
          </AlertDescription>
        </Alert>
      )}

      {showBusinessForm && !hasActiveSubscription && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Complete Your Subscription</CardTitle>
            <CardDescription>
              Subscribing to {tiers && selectedTier ? tiers[selectedTier]?.name : "Managed Pricing"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="form-business-name">Business Name (optional)</Label>
              <Input
                id="form-business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business name"
                data-testid="input-form-business-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-phone">Contact Phone (optional)</Label>
              <Input
                id="form-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
                data-testid="input-form-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-notes">Special Notes (optional)</Label>
              <Textarea
                id="form-notes"
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Any special requirements..."
                className="resize-none"
                rows={2}
                data-testid="input-form-notes"
              />
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              onClick={handleConfirmSubscribe}
              disabled={checkoutMutation.isPending}
              data-testid="button-confirm-subscribe"
            >
              {checkoutMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue to Payment
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelForm}
              data-testid="button-cancel-form"
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>
      )}

      {!hasActiveSubscription && !showBusinessForm && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {tierEntries.map(([key, tier]) => {
            const price = tier.priceMonthly / 100;
            const itemCount = subscription?.itemCount || 0;
            const exceedsLimit = tier.maxItems !== null && itemCount > tier.maxItems;

            return (
              <Card key={key} className={isCanceled && subscription?.tier === key ? "border-primary" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{tier.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">${price}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <p className="text-sm text-muted-foreground mb-2">{tier.description}</p>
                  <div className="flex items-center gap-1 text-xs">
                    <Package className="h-3 w-3" />
                    <span>{tier.maxItems ? `Up to ${tier.maxItems} items` : "Unlimited items"}</span>
                  </div>
                  {exceedsLimit && (
                    <p className="text-xs text-destructive mt-1">
                      You have {itemCount} items (exceeds limit)
                    </p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={exceedsLimit || checkoutMutation.isPending || !stripePrices?.[key]}
                    onClick={() => handleSubscribe(key)}
                    data-testid={`button-mp-tier-${key}`}
                  >
                    {checkoutMutation.isPending && selectedTier === key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {!stripePrices?.[key] ? "Coming Soon" : isCanceled && subscription?.tier === key ? "Reactivate" : "Subscribe"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DataTab() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [clearExisting, setClearExisting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/export", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `foodcost-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Export Complete",
        description: "Your data has been downloaded as a JSON file.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting your data.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    setIsImporting(true);
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);
      
      const response = await apiRequest("POST", "/api/import", {
        data,
        options: { clearExisting },
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Import Complete",
          description: `Imported ${result.stats.ingredients} ingredients, ${result.stats.recipes} recipes, and more.`,
        });
        queryClient.invalidateQueries();
        setImportFile(null);
      } else {
        throw new Error(result.error || "Import failed");
      }
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "There was an error importing your data.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
          </CardTitle>
          <CardDescription>
            Download all your data as a JSON file for backup or migration to another account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">What's included in the export:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2"><Package className="h-4 w-4" /> All ingredients with costs, densities, and settings</li>
              <li className="flex items-center gap-2"><FileText className="h-4 w-4" /> All recipes with ingredients and pricing</li>
              <li className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Category pricing settings and pricing snapshots</li>
              <li className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI provider preferences</li>
              <li className="flex items-center gap-2"><Database className="h-4 w-4" /> Dashboard configurations, waste logs, and inventory counts</li>
            </ul>
          </div>
          <Button 
            onClick={handleExport} 
            disabled={isExporting}
            className="w-full"
            data-testid="button-export"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download Backup File
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </CardTitle>
          <CardDescription>
            Restore data from a backup file or migrate from another account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Importing data will add to your existing data. Check "Clear existing data" below if you want to replace everything.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label htmlFor="import-file">Backup File</Label>
            <Input
              id="import-file"
              type="file"
              accept=".json"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              data-testid="input-import-file"
            />
          </div>

          {importFile && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded">
              <FileJson className="h-4 w-4" />
              <span className="text-sm">{importFile.name}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 ml-auto"
                onClick={() => setImportFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="clear-existing"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="rounded"
              data-testid="checkbox-clear-existing"
            />
            <Label htmlFor="clear-existing" className="text-sm cursor-pointer">
              Clear existing data before import (removes all current ingredients and recipes)
            </Label>
          </div>

          <Button 
            onClick={handleImport} 
            disabled={!importFile || isImporting}
            className="w-full"
            variant={clearExisting ? "destructive" : "default"}
            data-testid="button-import"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {clearExisting ? "Replace All Data" : "Import Data"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const initialTab = searchParams.get('tab') || 'ai';
  const status = searchParams.get('status');
  const managedPricingStatus = searchParams.get('managed_pricing_status');
  const { toast } = useToast();

  useEffect(() => {
    if (status === 'success') {
      toast({
        title: "Subscription activated",
        description: "Your subscription has been activated successfully. Enjoy your AI features!",
      });
    } else if (status === 'canceled') {
      toast({
        title: "Checkout canceled",
        description: "Your subscription checkout was canceled. You can try again anytime.",
        variant: "destructive",
      });
    }
  }, [status, toast]);

  useEffect(() => {
    if (managedPricingStatus === 'success') {
      toast({
        title: "Managed Pricing Activated",
        description: "Welcome! We'll start managing your pricing soon.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/managed-pricing"] });
      window.history.replaceState({}, '', '/settings?tab=billing');
    } else if (managedPricingStatus === 'canceled') {
      toast({
        title: "Checkout canceled",
        description: "Your managed pricing checkout was canceled. You can try again anytime.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/settings?tab=billing');
    }
  }, [managedPricingStatus, toast]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your AI and billing settings</p>
        </div>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ai" data-testid="tab-ai">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Provider
          </TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">
            <CreditCard className="h-4 w-4 mr-2" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="data" data-testid="tab-data">
            <Database className="h-4 w-4 mr-2" />
            Data
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ai" className="mt-6">
          <AISettingsTab />
        </TabsContent>
        <TabsContent value="billing" className="mt-6">
          <BillingTab />
        </TabsContent>
        <TabsContent value="data" className="mt-6">
          <DataTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
