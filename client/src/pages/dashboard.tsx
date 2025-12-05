import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardStats } from "@/components/dashboard-stats";
import { ChartWidget } from "@/components/dashboard-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageCircle, Send, Loader2, Sparkles, X, Minimize2, Maximize2, Plus, LayoutGrid } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Ingredient, Recipe, DashboardConfig, DashboardChartType, WasteLog } from "@shared/schema";
import { dashboardChartLabels, dashboardChartTypes } from "@shared/schema";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChartTypeInfo {
  type: string;
  name: string;
  description: string;
}

export default function DashboardPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [addChartOpen, setAddChartOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm your MenuMetrics assistant. Ask me anything about your menu, ingredients, costs, or margins. Try asking:\n\n- What's my highest margin item?\n- How many recipes do I have?\n- What's my average profit margin?" }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: ingredients = [], isLoading: ingredientsLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const { data: recipes = [], isLoading: recipesLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: dashboardConfigs = [], isLoading: configsLoading } = useQuery<DashboardConfig[]>({
    queryKey: ["/api/dashboard-configs"],
  });

  const { data: chartTypes = [] } = useQuery<ChartTypeInfo[]>({
    queryKey: ["/api/dashboard-chart-types"],
  });

  const { data: wasteLogs = [] } = useQuery<WasteLog[]>({
    queryKey: ["/api/waste-logs"],
  });

  const addChartMutation = useMutation({
    mutationFn: async (chartType: string) => {
      const res = await apiRequest("POST", "/api/dashboard-configs", { chartType });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-configs"] });
      setAddChartOpen(false);
    },
  });

  const removeChartMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/dashboard-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-configs"] });
    },
  });

  const toggleWidthMutation = useMutation({
    mutationFn: async (id: string) => {
      const config = dashboardConfigs.find((c) => c.id === id);
      if (!config) return;
      const newWidth = config.width === "half" ? "full" : "half";
      const res = await apiRequest("PATCH", `/api/dashboard-configs/${id}`, { width: newWidth });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-configs"] });
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/ai/dashboard-chat", { message });
      return await res.json() as { response: string };
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.response || "I couldn't generate a response." }]);
    },
    onError: (error: any) => {
      setMessages(prev => [...prev, { role: "assistant", content: `Sorry, I couldn't process that request. ${error.message || "Please try again."}` }]);
    },
  });

  const handleSendMessage = () => {
    if (!chatInput.trim() || chatMutation.isPending) return;
    
    const userMessage = chatInput.trim();
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatInput("");
    chatMutation.mutate(userMessage);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (ingredientsLoading || recipesLoading || configsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const visibleConfigs = dashboardConfigs
    .filter((c) => c.isVisible)
    .sort((a, b) => a.position - b.position);

  const activeChartTypes = new Set(visibleConfigs.map((c) => c.chartType));
  const availableChartTypes = chartTypes.filter((ct) => !activeChartTypes.has(ct.type));

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your ingredients, recipes, and cost analysis
            </p>
          </div>
          <Dialog open={addChartOpen} onOpenChange={setAddChartOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-chart">
                <Plus className="h-4 w-4 mr-2" />
                Add Chart
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Add Chart to Dashboard
                </DialogTitle>
                <DialogDescription>
                  Choose a chart to add to your dashboard. You can rearrange and resize charts later.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                {availableChartTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    All available charts are already on your dashboard.
                  </p>
                ) : (
                  availableChartTypes.map((chartType) => (
                    <Card
                      key={chartType.type}
                      className="hover-elevate cursor-pointer"
                      onClick={() => addChartMutation.mutate(chartType.type)}
                      data-testid={`add-chart-option-${chartType.type}`}
                    >
                      <CardHeader className="py-3">
                        <CardTitle className="text-base">{chartType.name}</CardTitle>
                        <CardDescription className="text-xs">{chartType.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <DashboardStats ingredients={ingredients} recipes={recipes} />

        {visibleConfigs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Charts Yet</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-md">
                Add charts to your dashboard to visualize your menu data. Click the "Add Chart" button above to get started.
              </p>
              <Button onClick={() => setAddChartOpen(true)} data-testid="button-add-first-chart">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Chart
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {visibleConfigs.map((config) => (
              <div
                key={config.id}
                className={config.width === "full" ? "md:col-span-2" : ""}
              >
                <ChartWidget
                  config={config}
                  ingredients={ingredients}
                  recipes={recipes}
                  wasteLogs={wasteLogs}
                  onRemove={(id) => removeChartMutation.mutate(id)}
                  onToggleWidth={(id) => toggleWidthMutation.mutate(id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {!chatOpen && (
        <Button
          onClick={() => setChatOpen(true)}
          style={{
            position: 'fixed',
            bottom: '1rem',
            right: '1rem',
            zIndex: 9999,
          }}
          className="h-14 w-14 rounded-full shadow-lg"
          size="icon"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {chatOpen && (
        <Card style={{
          position: 'fixed',
          zIndex: 9999,
          bottom: chatExpanded ? '1rem' : '1rem',
          right: chatExpanded ? '1rem' : '1rem',
          left: chatExpanded ? '0.5rem' : 'auto',
          top: chatExpanded ? '5rem' : 'auto',
          width: chatExpanded ? 'calc(100% - 1rem)' : '380px',
          maxWidth: chatExpanded ? '500px' : 'none',
          height: chatExpanded ? 'auto' : '500px',
        }} className={`shadow-2xl transition-all duration-200 ${
          chatExpanded 
            ? "md:w-[500px]" 
            : "w-[380px]"
        }`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 py-3 px-4 border-b">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Menu Assistant</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setChatExpanded(!chatExpanded)}
                data-testid="button-expand-chat"
              >
                {chatExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setChatOpen(false)}
                data-testid="button-close-chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col p-0 h-[calc(100%-120px)]">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      data-testid={`chat-message-${msg.role}-${i}`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="p-4 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about your menu..."
                  disabled={chatMutation.isPending}
                  data-testid="input-chat-message"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!chatInput.trim() || chatMutation.isPending}
                  data-testid="button-send-chat"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
