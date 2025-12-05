import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardStats } from "@/components/dashboard-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Loader2, Sparkles, X, Minimize2, Maximize2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Ingredient, Recipe } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function DashboardPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
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

  if (ingredientsLoading || recipesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const categoryData = ingredients.reduce((acc, ing) => {
    const existing = acc.find((item) => item.name === ing.category);
    if (existing) {
      existing.count += 1;
      existing.value += ing.costPerUnit * ing.quantity;
    } else {
      acc.push({
        name: ing.category,
        count: 1,
        value: ing.costPerUnit * ing.quantity,
      });
    }
    return acc;
  }, [] as Array<{ name: string; count: number; value: number }>);

  const topRecipesByPerUnitCost = [...recipes]
    .map((r) => ({
      ...r,
      costPerServing: r.servings > 0 ? r.totalCost / r.servings : 0,
    }))
    .sort((a, b) => b.costPerServing - a.costPerServing)
    .slice(0, 5)
    .map((r) => ({
      name: r.name.length > 15 ? r.name.substring(0, 15) + "..." : r.name,
      cost: r.costPerServing,
    }));

  const leastExpensiveRecipes = [...recipes]
    .map((r) => ({
      ...r,
      costPerServing: r.servings > 0 ? r.totalCost / r.servings : 0,
    }))
    .sort((a, b) => a.costPerServing - b.costPerServing)
    .slice(0, 5)
    .map((r) => ({
      name: r.name.length > 15 ? r.name.substring(0, 15) + "..." : r.name,
      cost: r.costPerServing,
    }));

  const mostProfitableByDollarAmount = [...recipes]
    .filter((r) => r.menuPrice && r.menuPrice > 0)
    .map((r) => ({
      ...r,
      costPerServing: r.servings > 0 ? r.totalCost / r.servings : 0,
      profitPerUnit: (r.menuPrice || 0) - (r.servings > 0 ? r.totalCost / r.servings : 0),
    }))
    .sort((a, b) => b.profitPerUnit - a.profitPerUnit)
    .slice(0, 5)
    .map((r) => ({
      name: r.name.length > 15 ? r.name.substring(0, 15) + "..." : r.name,
      profit: r.profitPerUnit,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your ingredients, recipes, and cost analysis
        </p>
      </div>

      <DashboardStats ingredients={ingredients} recipes={recipes} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most Expensive Recipes</CardTitle>
            <CardDescription>Highest cost per serving</CardDescription>
          </CardHeader>
          <CardContent>
            {topRecipesByPerUnitCost.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recipes yet. Create your first recipe to see cost analysis.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topRecipesByPerUnitCost}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Cost-Efficient Recipes</CardTitle>
            <CardDescription>Lowest cost per serving</CardDescription>
          </CardHeader>
          <CardContent>
            {leastExpensiveRecipes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recipes yet. Create your first recipe to see cost analysis.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leastExpensiveRecipes}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ingredients by Category</CardTitle>
            <CardDescription>Distribution of your inventory</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No ingredients yet. Add ingredients to see category breakdown.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Margin Analysis</CardTitle>
            <CardDescription>Most profitable by dollar per unit</CardDescription>
          </CardHeader>
          <CardContent>
            {mostProfitableByDollarAmount.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recipes with menu prices yet. Set menu prices to see margin analysis.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mostProfitableByDollarAmount}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Bar dataKey="profit" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Chat Button */}
      {!chatOpen && (
        <Button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {/* Chat Window */}
      {chatOpen && (
        <Card className={`fixed z-50 shadow-2xl transition-all duration-200 ${
          chatExpanded 
            ? "bottom-4 right-4 left-4 top-20 md:left-auto md:w-[500px] md:top-20" 
            : "bottom-6 right-6 w-[380px] h-[500px]"
        }`}>
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
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
    </div>
  );
}
