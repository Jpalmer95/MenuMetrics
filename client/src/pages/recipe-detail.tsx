import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeBuilder } from "@/components/recipe-builder";
import type {
  Recipe,
  RecipeWithIngredients,
  Ingredient,
  RecipeIngredient,
  InsertRecipeIngredient,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RecipeDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: recipe, isLoading: recipeLoading } = useQuery<RecipeWithIngredients>({
    queryKey: ["/api/recipes", id],
    enabled: !!id,
  });

  const { data: ingredients = [], isLoading: ingredientsLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const addIngredientMutation = useMutation({
    mutationFn: (data: InsertRecipeIngredient) =>
      apiRequest("POST", `/api/recipes/${id}/ingredients`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: "Success",
        description: "Ingredient added to recipe",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add ingredient",
        variant: "destructive",
      });
    },
  });

  const removeIngredientMutation = useMutation({
    mutationFn: (recipeIngredientId: string) =>
      apiRequest("DELETE", `/api/recipes/${id}/ingredients/${recipeIngredientId}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: "Success",
        description: "Ingredient removed from recipe",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove ingredient",
        variant: "destructive",
      });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: ({ recipeIngredientId, quantity }: { recipeIngredientId: string; quantity: number }) =>
      apiRequest("PATCH", `/api/recipes/${id}/ingredients/${recipeIngredientId}`, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
  });

  const handleAddIngredient = (ingredientId: string, quantity: number, unit: string) => {
    addIngredientMutation.mutate({
      recipeId: id!,
      ingredientId,
      quantity,
      unit,
    });
  };

  const handleRemoveIngredient = (recipeIngredientId: string) => {
    removeIngredientMutation.mutate(recipeIngredientId);
  };

  const handleUpdateQuantity = (recipeIngredientId: string, quantity: number) => {
    updateQuantityMutation.mutate({ recipeIngredientId, quantity });
  };

  if (recipeLoading || ingredientsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading recipe...</p>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Recipe not found</p>
        <Button onClick={() => setLocation("/recipes")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Recipes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/recipes")}
          data-testid="button-back-to-recipes"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{recipe.name}</h1>
          <p className="text-muted-foreground mt-1">
            {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""} • $
            {recipe.costPerServing.toFixed(2)} per serving
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-destructive" data-testid="text-recipe-total-cost">
              ${recipe.totalCost.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cost per Serving
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums" data-testid="text-recipe-cost-per-serving">
              ${recipe.costPerServing.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recommended Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-success">
              ${(recipe.totalCost * 3).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">3x markup (66% margin)</p>
          </CardContent>
        </Card>
      </div>

      <RecipeBuilder
        ingredients={ingredients}
        recipeIngredients={recipe.ingredients || []}
        onAddIngredient={handleAddIngredient}
        onRemoveIngredient={handleRemoveIngredient}
        onUpdateQuantity={handleUpdateQuantity}
      />
    </div>
  );
}
