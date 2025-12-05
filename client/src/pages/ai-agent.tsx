import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Sparkles, Loader2, DollarSign, Lightbulb, Plus, Check, 
  Calendar, TrendingUp, ChefHat, MapPin, ShoppingCart,
  AlertCircle, Info
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Ingredient, Recipe } from "@shared/schema";

interface AIRecipe {
  name: string;
  description?: string;
  category: string;
  servings: number;
  estimatedCost?: number;
  suggestedPrice?: number;
  ingredients: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
    inInventory?: boolean;
    matchedIngredient?: string;
  }>;
  missingIngredients?: string[];
}

interface SeasonalSuggestion {
  name: string;
  description: string;
  category: string;
  season: string;
  targetAudience: string;
  estimatedMargin: string;
  ingredients: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
    inInventory?: boolean;
  }>;
}

interface PricingRecommendation {
  recipeName: string;
  currentPrice: number;
  currentCost: number;
  currentMargin: number;
  recommendedPrice: number;
  recommendedMargin: number;
  reasoning: string;
  priority: "high" | "medium" | "low";
}

interface BusinessAdvice {
  strategy: string;
  recommendations: string[];
  premiumOpportunities: Array<{
    name: string;
    description: string;
    priceRange: string;
    targetCustomer: string;
  }>;
  competitiveAnalysis: string;
}

export default function AIAgentPage() {
  const [activeTab, setActiveTab] = useState("recipe-creator");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ingredients = [] } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          AI Business Assistant
        </h1>
        <p className="text-muted-foreground mt-2">
          Intelligent tools to help you create recipes, plan seasonal menus, optimize pricing, and develop business strategy.
          All suggestions use your actual inventory and recipes for accurate recommendations.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Safe & Secure</AlertTitle>
        <AlertDescription>
          AI assistants can only suggest and create new items. They cannot modify or delete your existing inventory, recipes, or settings.
          All AI-generated recipes require your explicit approval before being added.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="recipe-creator" className="flex flex-col gap-1 py-3" data-testid="tab-recipe-creator">
            <ChefHat className="h-5 w-5" />
            <span className="text-xs">Recipe Creator</span>
          </TabsTrigger>
          <TabsTrigger value="seasonal-planner" className="flex flex-col gap-1 py-3" data-testid="tab-seasonal-planner">
            <Calendar className="h-5 w-5" />
            <span className="text-xs">Seasonal Planner</span>
          </TabsTrigger>
          <TabsTrigger value="pricing-strategist" className="flex flex-col gap-1 py-3" data-testid="tab-pricing-strategist">
            <DollarSign className="h-5 w-5" />
            <span className="text-xs">Pricing Strategy</span>
          </TabsTrigger>
          <TabsTrigger value="business-advisor" className="flex flex-col gap-1 py-3" data-testid="tab-business-advisor">
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Business Advisor</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recipe-creator">
          <RecipeCreatorTab ingredients={ingredients} />
        </TabsContent>

        <TabsContent value="seasonal-planner">
          <SeasonalPlannerTab ingredients={ingredients} />
        </TabsContent>

        <TabsContent value="pricing-strategist">
          <PricingStrategistTab recipes={recipes} />
        </TabsContent>

        <TabsContent value="business-advisor">
          <BusinessAdvisorTab ingredients={ingredients} recipes={recipes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecipeCreatorTab({ ingredients }: { ingredients: Ingredient[] }) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [recipes, setRecipes] = useState<AIRecipe[] | null>(null);
  const [addedRecipes, setAddedRecipes] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const recipeIdeasMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/ai/recipe-ideas", {
        customPrompt: customPrompt.trim() || undefined,
        includeIngredientMatching: true,
      });
    },
    onSuccess: (data) => {
      setRecipes(data.recipes || []);
      setAddedRecipes(new Set());
      toast({
        title: "Recipes Generated",
        description: data.recipes?.length 
          ? `Found ${data.recipes.length} recipe ideas based on your inventory.`
          : "AI has suggested recipes based on your ingredients.",
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

  const addRecipeMutation = useMutation({
    mutationFn: async (recipe: AIRecipe) => {
      return await apiRequest("POST", "/api/ai/create-recipe", recipe);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setAddedRecipes(prev => new Set(prev).add(variables.name));
      toast({
        title: "Recipe Added",
        description: `"${variables.name}" has been added to your recipes.`,
      });
    },
    onError: (error: any, variables) => {
      toast({
        title: "Error",
        description: error.message || `Failed to add "${variables.name}".`,
        variant: "destructive",
      });
    },
  });

  const ingredientCount = ingredients.length;
  const hasInventory = ingredientCount > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Create New Recipes
          </CardTitle>
          <CardDescription>
            Generate recipe ideas using your {ingredientCount} inventory items. 
            AI will match ingredients you have and identify what you'd need to buy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasInventory && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Add ingredients to your inventory first to get personalized recipe suggestions.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="recipe-prompt">What kind of recipes are you looking for?</Label>
            <Textarea
              id="recipe-prompt"
              placeholder="Examples: 'holiday drinks for December', 'vegan breakfast options', 'high-margin cold beverages', 'signature lattes under $3 cost'..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              data-testid="input-recipe-prompt"
            />
          </div>

          <Button
            onClick={() => recipeIdeasMutation.mutate()}
            disabled={recipeIdeasMutation.isPending || !hasInventory}
            className="w-full"
            data-testid="button-generate-recipes"
          >
            {recipeIdeasMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Recipes...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Recipe Ideas
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Recipes</CardTitle>
          <CardDescription>
            Review AI suggestions and add them to your recipe book with one click
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {recipes && recipes.length > 0 ? (
              <div className="space-y-4">
                {recipes.map((recipe, index) => {
                  const isAdded = addedRecipes.has(recipe.name);
                  const hasIngredients = recipe.ingredients?.filter(i => i.inInventory !== false).length || 0;
                  const missingCount = recipe.missingIngredients?.length || 0;
                  
                  return (
                    <Card key={index} className="overflow-hidden">
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">{recipe.name}</h4>
                            {recipe.description && (
                              <p className="text-sm text-muted-foreground mt-1">{recipe.description}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addRecipeMutation.mutate(recipe)}
                            disabled={isAdded || addRecipeMutation.isPending}
                            data-testid={`button-add-recipe-${index}`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{recipe.category.replace(/_/g, ' ')}</Badge>
                          <Badge variant="outline">{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</Badge>
                          {recipe.estimatedCost && (
                            <Badge variant="secondary">~${recipe.estimatedCost.toFixed(2)} cost</Badge>
                          )}
                          {recipe.suggestedPrice && (
                            <Badge className="bg-green-600">${recipe.suggestedPrice.toFixed(2)} suggested</Badge>
                          )}
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-muted-foreground">
                              {hasIngredients} ingredients in stock
                            </span>
                          </div>
                          
                          {missingCount > 0 && (
                            <div className="flex items-start gap-2 text-sm">
                              <ShoppingCart className="h-4 w-4 text-orange-500 mt-0.5" />
                              <div>
                                <span className="text-muted-foreground">Need to buy: </span>
                                <span className="text-orange-600">
                                  {recipe.missingIngredients?.join(", ")}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          <strong>Ingredients:</strong>{" "}
                          {recipe.ingredients.map((ing, i) => (
                            <span key={i} className={ing.inInventory === false ? "text-orange-600" : ""}>
                              {ing.quantity} {ing.unit} {ing.ingredientName}
                              {i < recipe.ingredients.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
                <ChefHat className="h-12 w-12 mb-4 opacity-20" />
                <p>No recipes generated yet.</p>
                <p className="text-sm">Click "Generate Recipe Ideas" to get started!</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function SeasonalPlannerTab({ ingredients }: { ingredients: Ingredient[] }) {
  const [season, setSeason] = useState("winter");
  const [customPrompt, setCustomPrompt] = useState("");
  const [suggestions, setSuggestions] = useState<SeasonalSuggestion[] | null>(null);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const seasonalMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/ai/seasonal-suggestions", {
        season,
        customPrompt: customPrompt.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      setAddedItems(new Set());
      toast({
        title: "Seasonal Ideas Generated",
        description: `Found ${data.suggestions?.length || 0} ${season} menu suggestions.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate seasonal suggestions",
        variant: "destructive",
      });
    },
  });

  const addRecipeMutation = useMutation({
    mutationFn: async (suggestion: SeasonalSuggestion) => {
      return await apiRequest("POST", "/api/ai/create-recipe", {
        name: suggestion.name,
        description: suggestion.description,
        category: suggestion.category,
        servings: 1,
        ingredients: suggestion.ingredients,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setAddedItems(prev => new Set(prev).add(variables.name));
      toast({
        title: "Recipe Added",
        description: `"${variables.name}" has been added to your recipes.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add recipe",
        variant: "destructive",
      });
    },
  });

  const seasons = [
    { value: "winter", label: "Winter / Holiday", icon: "❄" },
    { value: "spring", label: "Spring", icon: "🌸" },
    { value: "summer", label: "Summer", icon: "☀" },
    { value: "fall", label: "Fall / Autumn", icon: "🍂" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Seasonal Menu Planner
          </CardTitle>
          <CardDescription>
            Get AI-powered suggestions for seasonal specials, holiday drinks, and limited-time offerings
            based on your current inventory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Season</Label>
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger data-testid="select-season">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.icon} {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seasonal-prompt">Additional Details (Optional)</Label>
            <Textarea
              id="seasonal-prompt"
              placeholder="Examples: 'focus on hot beverages', 'include vegan options', 'Valentine's Day specials', 'pumpkin spice variations'..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              data-testid="input-seasonal-prompt"
            />
          </div>

          <Button
            onClick={() => seasonalMutation.mutate()}
            disabled={seasonalMutation.isPending}
            className="w-full"
            data-testid="button-generate-seasonal"
          >
            {seasonalMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Planning Menu...
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                Generate Seasonal Ideas
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seasonal Suggestions</CardTitle>
          <CardDescription>
            Limited-time offerings and seasonal specials for your menu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {suggestions && suggestions.length > 0 ? (
              <div className="space-y-4">
                {suggestions.map((suggestion, index) => {
                  const isAdded = addedItems.has(suggestion.name);
                  
                  return (
                    <Card key={index} className="overflow-hidden">
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">{suggestion.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addRecipeMutation.mutate(suggestion)}
                            disabled={isAdded || addRecipeMutation.isPending}
                            data-testid={`button-add-seasonal-${index}`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{suggestion.season}</Badge>
                          <Badge variant="outline">{suggestion.category}</Badge>
                          <Badge variant="secondary">{suggestion.targetAudience}</Badge>
                          {suggestion.estimatedMargin && (
                            <Badge className="bg-green-600">{suggestion.estimatedMargin} margin</Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          <strong>Ingredients:</strong>{" "}
                          {suggestion.ingredients.map((ing, i) => (
                            <span key={i} className={ing.inInventory === false ? "text-orange-600" : ""}>
                              {ing.quantity} {ing.unit} {ing.ingredientName}
                              {i < suggestion.ingredients.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 opacity-20" />
                <p>No seasonal suggestions yet.</p>
                <p className="text-sm">Select a season and generate ideas!</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function PricingStrategistTab({ recipes }: { recipes: Recipe[] }) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [analysis, setAnalysis] = useState<string>("");
  const [recommendations, setRecommendations] = useState<PricingRecommendation[] | null>(null);
  const { toast } = useToast();

  const pricingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/ai/pricing-analysis", {
        customPrompt: customPrompt.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis || "");
      setRecommendations(data.recommendations || []);
      toast({
        title: "Pricing Analysis Complete",
        description: "AI has analyzed your menu pricing and provided recommendations.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to analyze pricing",
        variant: "destructive",
      });
    },
  });

  const recipesWithPricing = recipes.filter(r => r.menuPrice && r.menuPrice > 0);
  const avgMargin = recipesWithPricing.length > 0
    ? recipesWithPricing.reduce((sum, r) => {
        const margin = r.menuPrice ? ((r.menuPrice - (r.totalCost || 0)) / r.menuPrice * 100) : 0;
        return sum + margin;
      }, 0) / recipesWithPricing.length
    : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Pricing Strategy Analysis
          </CardTitle>
          <CardDescription>
            Get AI-powered recommendations to optimize your menu pricing for maximum profitability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="text-2xl font-bold">{recipes.length}</div>
              <div className="text-xs text-muted-foreground">Total Recipes</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="text-2xl font-bold">{avgMargin.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Avg Margin</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-prompt">Specific Focus (Optional)</Label>
            <Textarea
              id="pricing-prompt"
              placeholder="Examples: 'focus on increasing beverage margins', 'competitive pricing for downtown location', 'premium positioning strategy'..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              data-testid="input-pricing-prompt"
            />
          </div>

          <Button
            onClick={() => pricingMutation.mutate()}
            disabled={pricingMutation.isPending || recipes.length === 0}
            className="w-full"
            data-testid="button-analyze-pricing"
          >
            {pricingMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Pricing...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                Analyze Menu Pricing
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Recommendations</CardTitle>
          <CardDescription>
            AI-generated insights to improve your profit margins
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {analysis ? (
              <div className="space-y-4">
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-sm" data-testid="text-pricing-analysis">
                    {analysis}
                  </div>
                </div>

                {recommendations && recommendations.length > 0 && (
                  <>
                    <Separator />
                    <h4 className="font-semibold">Specific Recommendations</h4>
                    <div className="space-y-3">
                      {recommendations.map((rec, index) => (
                        <div key={index} className="bg-muted/50 p-3 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{rec.recipeName}</span>
                            <Badge variant={
                              rec.priority === "high" ? "destructive" : 
                              rec.priority === "medium" ? "default" : "secondary"
                            }>
                              {rec.priority} priority
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Current: </span>
                              <span>${rec.currentPrice.toFixed(2)} ({rec.currentMargin.toFixed(0)}%)</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Suggested: </span>
                              <span className="text-green-600 font-medium">
                                ${rec.recommendedPrice.toFixed(2)} ({rec.recommendedMargin.toFixed(0)}%)
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{rec.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
                <DollarSign className="h-12 w-12 mb-4 opacity-20" />
                <p>No pricing analysis yet.</p>
                <p className="text-sm">Click "Analyze Menu Pricing" to get recommendations!</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function BusinessAdvisorTab({ ingredients, recipes }: { ingredients: Ingredient[], recipes: Recipe[] }) {
  const [businessType, setBusinessType] = useState("coffee_shop");
  const [location, setLocation] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [advice, setAdvice] = useState<string>("");
  const { toast } = useToast();

  const advisorMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/ai/business-advice", {
        businessType,
        location: location.trim() || undefined,
        customPrompt: customPrompt.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      setAdvice(data.advice || "");
      toast({
        title: "Business Analysis Complete",
        description: "AI has provided strategic recommendations for your business.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate business advice",
        variant: "destructive",
      });
    },
  });

  const businessTypes = [
    { value: "coffee_shop", label: "Coffee Shop / Cafe" },
    { value: "bakery", label: "Bakery" },
    { value: "restaurant", label: "Restaurant" },
    { value: "food_truck", label: "Food Truck" },
    { value: "catering", label: "Catering Service" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Strategic Business Advisor
          </CardTitle>
          <CardDescription>
            Get personalized business strategy recommendations, premium product ideas, 
            and competitive positioning advice based on your location and market.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="text-2xl font-bold">{ingredients.length}</div>
              <div className="text-xs text-muted-foreground">Inventory Items</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="text-2xl font-bold">{recipes.length}</div>
              <div className="text-xs text-muted-foreground">Menu Items</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Business Type</Label>
            <Select value={businessType} onValueChange={setBusinessType}>
              <SelectTrigger data-testid="select-business-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {businessTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location / Area Description (Optional)</Label>
            <Input
              id="location"
              placeholder="e.g., 'lakeside resort area, affluent neighborhood', 'downtown business district', 'college town'..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              data-testid="input-location"
            />
            <p className="text-xs text-muted-foreground">
              Describe your location to get targeted recommendations for your market
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-prompt">What would you like advice on?</Label>
            <Textarea
              id="business-prompt"
              placeholder="Examples: 'how to attract higher-end customers', 'launching a signature drink program', 'expanding into catering', 'competing with chain coffee shops'..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              data-testid="input-business-prompt"
            />
          </div>

          <Button
            onClick={() => advisorMutation.mutate()}
            disabled={advisorMutation.isPending}
            className="w-full"
            data-testid="button-get-advice"
          >
            {advisorMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Business...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Get Business Advice
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strategic Recommendations</CardTitle>
          <CardDescription>
            Personalized advice to grow your business and increase profitability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {advice ? (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm" data-testid="text-business-advice">
                  {advice}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-4 opacity-20" />
                <p>No business advice generated yet.</p>
                <p className="text-sm">Tell us about your business to get started!</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
