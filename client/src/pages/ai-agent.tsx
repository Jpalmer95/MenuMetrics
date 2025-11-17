import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, DollarSign, Lightbulb, Plus, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AIRecipe {
  name: string;
  description?: string;
  category: string;
  servings: number;
  ingredients: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
  }>;
}

export default function AIAgentPage() {
  const [recipeIdeas, setRecipeIdeas] = useState<string>("");
  const [recipes, setRecipes] = useState<AIRecipe[] | null>(null);
  const [addedRecipes, setAddedRecipes] = useState<Set<string>>(new Set());
  const [customRecipePrompt, setCustomRecipePrompt] = useState<string>("");
  const [menuStrategy, setMenuStrategy] = useState<string>("");
  const [customStrategyPrompt, setCustomStrategyPrompt] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const recipeIdeasMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/recipe-ideas", {
        customPrompt: customRecipePrompt.trim() || undefined,
      });
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      setRecipeIdeas(data.response);
      setRecipes(data.recipes);
      setAddedRecipes(new Set()); // Reset added recipes when new ideas generated
      toast({
        title: "Recipe Ideas Generated",
        description: data.recipes 
          ? `AI suggested ${data.recipes.length} recipes that you can add to your menu.`
          : "AI has suggested cost-effective recipes based on your ingredients.",
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
      const response = await apiRequest("POST", "/api/ai/create-recipe", recipe);
      return response.json();
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
        description: error.message || `Failed to add "${variables.name}". Some ingredients may not be in your database.`,
        variant: "destructive",
      });
    },
  });

  const menuStrategyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/menu-strategy", {
        customPrompt: customStrategyPrompt.trim() || undefined,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Recipe Agent</h1>
        <p className="text-muted-foreground mt-2">
          Use AI to discover cost-efficient recipes and optimize your menu pricing strategy. Configure AI provider in Settings.
        </p>
      </div>

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
            <div className="space-y-2">
              <Label htmlFor="custom-recipe-prompt">Custom Request (Optional)</Label>
              <Textarea
                id="custom-recipe-prompt"
                placeholder="e.g., Christmas drinks, vegan options, winter warming beverages..."
                value={customRecipePrompt}
                onChange={(e) => setCustomRecipePrompt(e.target.value)}
                rows={2}
                data-testid="input-custom-recipe-prompt"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for general suggestions, or describe what you're looking for
              </p>
            </div>

            <Button
              onClick={() => recipeIdeasMutation.mutate()}
              disabled={recipeIdeasMutation.isPending}
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

            {recipes && recipes.length > 0 ? (
              <div className="space-y-3">
                {recipes.map((recipe, index) => {
                  const isAdded = addedRecipes.has(recipe.name);
                  return (
                    <Card key={index} className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
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
                                Add to Recipes
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{recipe.category.replace(/_/g, ' ')}</Badge>
                          <Badge variant="outline">{recipe.servings} serving{recipe.servings > 1 ? 's' : ''}</Badge>
                          <Badge variant="outline">{recipe.ingredients.length} ingredients</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <strong>Ingredients:</strong> {recipe.ingredients.map(ing => 
                            `${ing.quantity} ${ing.unit} ${ing.ingredientName}`
                          ).join(', ')}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : recipeIdeas ? (
              <div className="rounded-md border p-4 bg-card">
                <pre className="whitespace-pre-wrap text-sm font-mono text-foreground" data-testid="text-recipe-ideas">
                  {recipeIdeas}
                </pre>
              </div>
            ) : null}
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
            <div className="space-y-2">
              <Label htmlFor="custom-strategy-prompt">Custom Request (Optional)</Label>
              <Textarea
                id="custom-strategy-prompt"
                placeholder="e.g., focus on high-margin items, strategies for holiday season..."
                value={customStrategyPrompt}
                onChange={(e) => setCustomStrategyPrompt(e.target.value)}
                rows={2}
                data-testid="input-custom-strategy-prompt"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for general analysis, or ask a specific question
              </p>
            </div>

            <Button
              onClick={() => menuStrategyMutation.mutate()}
              disabled={menuStrategyMutation.isPending}
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
