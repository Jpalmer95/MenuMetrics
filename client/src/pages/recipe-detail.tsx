import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeBuilder } from "@/components/recipe-builder";
import type {
  Recipe,
  RecipeWithIngredients,
  Ingredient,
  RecipeIngredient,
  InsertRecipeIngredient,
} from "@shared/schema";
import { calculateProfitMargin } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculateIngredientCost } from "@/lib/unit-conversions";

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
    onSuccess: (updatedRecipe: RecipeWithIngredients) => {
      queryClient.setQueryData(["/api/recipes", id], updatedRecipe);
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
    onSuccess: (updatedRecipe: RecipeWithIngredients) => {
      queryClient.setQueryData(["/api/recipes", id], updatedRecipe);
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
    onSuccess: (updatedRecipe: RecipeWithIngredients) => {
      queryClient.setQueryData(["/api/recipes", id], updatedRecipe);
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({ recipeIngredientId, unit }: { recipeIngredientId: string; unit: string }) =>
      apiRequest("PATCH", `/api/recipes/${id}/ingredients/${recipeIngredientId}`, { unit }),
    onSuccess: (updatedRecipe: RecipeWithIngredients) => {
      queryClient.setQueryData(["/api/recipes", id], updatedRecipe);
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

  const handleUpdateUnit = (recipeIngredientId: string, unit: string) => {
    updateUnitMutation.mutate({ recipeIngredientId, unit });
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

  // Calculate totals fresh from ingredients to ensure accuracy
  const calculateCost = (items: typeof recipe.ingredients) => {
    return items.reduce((sum, ri) => {
      const cost = calculateIngredientCost(
        ri.ingredientDetails,
        ri.quantity,
        ri.unit as any
      );
      return sum + cost;
    }, 0);
  };

  const recipeRegularIngredients = (recipe.ingredients || []).filter(
    (ri) => !ri.ingredientDetails.isPackaging
  );
  const recipePackagingItems = (recipe.ingredients || []).filter(
    (ri) => ri.ingredientDetails.isPackaging
  );

  const ingredientsCost = calculateCost(recipeRegularIngredients);
  const packagingCost = calculateCost(recipePackagingItems);
  const totalRecipeCost = ingredientsCost + packagingCost;
  const costPerServing = recipe.servings > 0 ? totalRecipeCost / recipe.servings : 0;

  const profitMargin = calculateProfitMargin(recipe.menuPrice, costPerServing);

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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">{recipe.name}</h1>
            <Badge variant="outline" data-testid="badge-recipe-category">
              {(recipe.category || "other").charAt(0).toUpperCase() + (recipe.category || "other").slice(1)}
            </Badge>
          </div>
          {recipe.description && (
            <p className="text-muted-foreground mt-2" data-testid="text-recipe-description">
              {recipe.description}
            </p>
          )}
          <p className="text-muted-foreground mt-1">
            {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""} • $
            {costPerServing.toFixed(2)} per serving
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-destructive" data-testid="text-recipe-total-cost">
              ${totalRecipeCost.toFixed(2)}
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
              ${costPerServing.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Menu Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recipe.menuPrice ? (
              <>
                <div className="text-2xl font-bold tabular-nums" data-testid="text-recipe-menu-price">
                  ${recipe.menuPrice.toFixed(2)}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Badge variant="secondary" className="text-muted-foreground w-fit" data-testid="badge-no-menu-price">
                  Not set
                </Badge>
                <p className="text-xs text-muted-foreground">
                  <DollarSign className="h-3 w-3 inline mr-1" />
                  Edit recipe to add
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profitMargin !== null ? (
              <>
                <div className="text-2xl font-bold tabular-nums" data-testid="text-recipe-profit-margin">
                  {profitMargin.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ${(recipe.menuPrice! - recipe.costPerServing).toFixed(2)} profit/serving
                </p>
              </>
            ) : (
              <Badge variant="outline" className="text-muted-foreground" data-testid="badge-no-profit-margin">
                Requires menu price
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <RecipeBuilder
        ingredients={ingredients}
        recipeIngredients={recipe.ingredients || []}
        onAddIngredient={handleAddIngredient}
        onRemoveIngredient={handleRemoveIngredient}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateUnit={handleUpdateUnit}
      />
    </div>
  );
}
