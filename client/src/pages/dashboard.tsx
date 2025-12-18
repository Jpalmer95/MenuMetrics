import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardStats } from "@/components/dashboard-stats";
import { SortableChartWidget, ChartWidget } from "@/components/dashboard-charts";
import { OnboardingWelcome } from "@/components/onboarding-welcome";
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
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

interface SuggestedChart {
  type: string;
  name: string;
  description: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestedCharts?: SuggestedChart[];
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
    { role: "assistant", content: "Hi! I'm your MenuMetrics assistant. Ask me anything about your menu, ingredients, costs, or margins. I can also suggest charts for your dashboard!\n\nTry asking:\n- What's my highest margin item?\n- Show me a chart of my food costs\n- Add a margin analysis chart\n- What's my average profit margin?" }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const { data: ingredients = [], isLoading: ingredientsLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const { data: recipes = [], isLoading: recipesLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: dashboardConfigs = [], isLoading: configsLoading } = useQuery<DashboardConfig[]>({
    queryKey: ["/api/dashboard-configs"],
  });

  const { data: chartTypesData } = useQuery<{ types: string[]; labels: Record<string, { name: string; description: string }> }>({
    queryKey: ["/api/dashboard-chart-types"],
  });

  const chartTypes: ChartTypeInfo[] = chartTypesData 
    ? chartTypesData.types.map(type => ({
        type,
        name: chartTypesData.labels[type]?.name || type,
        description: chartTypesData.labels[type]?.description || "",
      }))
    : [];

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

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await apiRequest("PATCH", "/api/dashboard-configs/reorder", { orderedIds });
    },
    onMutate: async (orderedIds: string[]) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/dashboard-configs"] });
      
      // Snapshot the previous value
      const previousConfigs = queryClient.getQueryData<DashboardConfig[]>(["/api/dashboard-configs"]);
      
      // Optimistically update with new order
      if (previousConfigs) {
        const newConfigs = orderedIds.map((id, index) => {
          const config = previousConfigs.find(c => c.id === id);
          return config ? { ...config, position: index } : null;
        }).filter(Boolean) as DashboardConfig[];
        
        // Keep any configs not in the ordered list
        const remainingConfigs = previousConfigs.filter(c => !orderedIds.includes(c.id));
        
        queryClient.setQueryData<DashboardConfig[]>(
          ["/api/dashboard-configs"],
          [...newConfigs, ...remainingConfigs]
        );
      }
      
      return { previousConfigs };
    },
    onError: (_err, _orderedIds, context) => {
      // Roll back on error
      if (context?.previousConfigs) {
        queryClient.setQueryData(["/api/dashboard-configs"], context.previousConfigs);
      }
    },
    onSettled: () => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-configs"] });
    },
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);
    
    if (over && active.id !== over.id) {
      const configs = dashboardConfigs.filter((c) => c.isVisible).sort((a, b) => a.position - b.position);
      const oldIndex = configs.findIndex((c) => c.id === active.id);
      const newIndex = configs.findIndex((c) => c.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(configs, oldIndex, newIndex);
        const orderedIds = newOrder.map((c) => c.id);
        reorderMutation.mutate(orderedIds);
      }
    }
  };

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/ai/dashboard-chat", { message });
      return await res.json() as { response: string; suggestedCharts?: SuggestedChart[] };
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.response || "I couldn't generate a response.",
        suggestedCharts: data.suggestedCharts,
      }]);
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

  // Show onboarding for first-time users with no ingredients
  if (ingredients.length === 0) {
    return <OnboardingWelcome />;
  }

  const visibleConfigs = dashboardConfigs
    .filter((c) => c.isVisible)
    .sort((a, b) => a.position - b.position);

  const activeConfig = activeId ? visibleConfigs.find(c => c.id === activeId) : null;

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
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleConfigs.map((c) => c.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-6">
                {visibleConfigs.map((config) => (
                  <SortableChartWidget
                    key={config.id}
                    config={config}
                    ingredients={ingredients}
                    recipes={recipes}
                    wasteLogs={wasteLogs}
                    onRemove={(id) => removeChartMutation.mutate(id)}
                    onToggleWidth={(id) => toggleWidthMutation.mutate(id)}
                    isOver={overId === config.id && activeId !== config.id}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeConfig && (
                <div className="opacity-90 rotate-2 scale-105">
                  <ChartWidget
                    config={activeConfig}
                    ingredients={ingredients}
                    recipes={recipes}
                    wasteLogs={wasteLogs}
                    isDragging={true}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
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
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      data-testid={`chat-message-${msg.role}-${i}`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {msg.suggestedCharts && msg.suggestedCharts.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium opacity-80">Suggested charts:</p>
                          {msg.suggestedCharts.map((chart) => (
                            <Button
                              key={chart.type}
                              variant="secondary"
                              size="sm"
                              className="w-full justify-start text-left h-auto py-2"
                              onClick={() => {
                                addChartMutation.mutate(chart.type);
                                setMessages(prev => prev.map((m, idx) => 
                                  idx === i 
                                    ? { ...m, suggestedCharts: m.suggestedCharts?.filter(c => c.type !== chart.type) }
                                    : m
                                ));
                              }}
                              disabled={addChartMutation.isPending}
                              data-testid={`button-add-suggested-chart-${chart.type}`}
                            >
                              <Plus className="h-3 w-3 mr-2 flex-shrink-0" />
                              <span className="truncate">{chart.name}</span>
                            </Button>
                          ))}
                        </div>
                      )}
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
