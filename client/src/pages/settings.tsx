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
import { Loader2, Settings as SettingsIcon, Key, Sparkles, CreditCard, Zap, Check, Crown, ExternalLink, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

type AIProvider = "openai" | "gemini" | "grok" | "claude" | "llama" | "mistral" | "deepseek" | "huggingface";

interface AISettings {
  aiProvider?: string | null;
  huggingfaceToken?: string | null;
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

function AISettingsTab() {
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
                    {isCurrentPlan ? "Current Plan" : "Subscribe"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const initialTab = searchParams.get('tab') || 'ai';
  const status = searchParams.get('status');
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai" data-testid="tab-ai">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Provider
          </TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">
            <CreditCard className="h-4 w-4 mr-2" />
            Subscription
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ai" className="mt-6">
          <AISettingsTab />
        </TabsContent>
        <TabsContent value="billing" className="mt-6">
          <BillingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
