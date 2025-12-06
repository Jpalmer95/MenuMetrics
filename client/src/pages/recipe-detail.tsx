import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, DollarSign, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipeBuilder } from "@/components/recipe-builder";
import type {
  Recipe,
  RecipeWithIngredients,
  Ingredient,
  RecipeIngredient,
  InsertRecipeIngredient,
  InsertRecipeSubIngredient,
  RecipeCategory,
} from "@shared/schema";
import { calculateProfitMargin, recipeCategories, recipeCategoryLabels } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculateIngredientCost } from "@/lib/unit-conversions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RecipeDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isEditingMenuPrice, setIsEditingMenuPrice] = useState(false);
  const [menuPriceInput, setMenuPriceInput] = useState("");
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isEditingServings, setIsEditingServings] = useState(false);
  const [servingsInput, setServingsInput] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const { data: recipe, isLoading: recipeLoading } = useQuery<RecipeWithIngredients>({
    queryKey: ["/api/recipes", id],
    enabled: !!id,
  });

  const { data: ingredients = [], isLoading: ingredientsLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const { data: allRecipes = [] } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
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

  const addSubRecipeMutation = useMutation({
    mutationFn: (data: { subRecipeId: string; quantity: number }) =>
      apiRequest("POST", `/api/recipes/${id}/sub-recipes`, data),
    onSuccess: (updatedRecipe: RecipeWithIngredients) => {
      queryClient.setQueryData(["/api/recipes", id], updatedRecipe);
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: "Success",
        description: "Recipe added as ingredient",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add recipe as ingredient",
        variant: "destructive",
      });
    },
  });

  const removeSubRecipeMutation = useMutation({
    mutationFn: (subRecipeIngredientId: string) =>
      apiRequest("DELETE", `/api/recipes/${id}/sub-recipes/${subRecipeIngredientId}`, undefined),
    onSuccess: (updatedRecipe: RecipeWithIngredients) => {
      queryClient.setQueryData(["/api/recipes", id], updatedRecipe);
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: "Success",
        description: "Recipe ingredient removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove recipe ingredient",
        variant: "destructive",
      });
    },
  });

  const updateSubRecipeQuantityMutation = useMutation({
    mutationFn: ({ subRecipeIngredientId, quantity }: { subRecipeIngredientId: string; quantity: number }) =>
      apiRequest("PATCH", `/api/recipes/${id}/sub-recipes/${subRecipeIngredientId}`, { quantity }),
    onSuccess: (updatedRecipe: RecipeWithIngredients) => {
      queryClient.setQueryData(["/api/recipes", id], updatedRecipe);
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
  });

  const updateMenuPriceMutation = useMutation({
    mutationFn: (menuPrice: number | null) =>
      apiRequest("PATCH", `/api/recipes/${id}/pricing`, { menuPrice }),
    onSuccess: (updatedRecipe: RecipeWithIngredients) => {
      queryClient.setQueryData(["/api/recipes", id], updatedRecipe);
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setIsEditingMenuPrice(false);
      toast({
        title: "Success",
        description: "Menu price updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update menu price",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: (category: RecipeCategory) =>
      apiRequest("PATCH", `/api/recipes/${id}/category`, { category }),
    onSuccess: (updatedRecipe: RecipeWithIngredients) => {
      queryClient.setQueryData(["/api/recipes", id], updatedRecipe);
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setIsEditingCategory(false);
      toast({
        title: "Success",
        description: "Category updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const updateServingsMutation = useMutation({
    mutationFn: (servings: number) =>
      apiRequest("PATCH", `/api/recipes/${id}/servings`, { servings }),
    onSuccess: (updatedRecipe: RecipeWithIngredients) => {
      queryClient.setQueryData(["/api/recipes", id], updatedRecipe);
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setIsEditingServings(false);
      toast({
        title: "Success",
        description: "Servings updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update servings",
        variant: "destructive",
      });
    },
  });

  const updateNameMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("PATCH", `/api/recipes/${id}/name`, { name }),
    onSuccess: (updatedRecipe: RecipeWithIngredients) => {
      queryClient.setQueryData(["/api/recipes", id], updatedRecipe);
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setIsEditingName(false);
      toast({
        title: "Success",
        description: "Recipe name updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update recipe name",
        variant: "destructive",
      });
    },
  });

  const handleStartEditName = () => {
    if (recipe) {
      setNameInput(recipe.name);
      setIsEditingName(true);
    }
  };

  const handleSaveName = () => {
    const trimmedName = nameInput.trim();
    if (trimmedName && trimmedName !== recipe?.name) {
      updateNameMutation.mutate(trimmedName);
    } else {
      setIsEditingName(false);
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setNameInput("");
  };

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

  const handleAddSubRecipe = (subRecipeId: string, quantity: number) => {
    addSubRecipeMutation.mutate({ subRecipeId, quantity });
  };

  const handleRemoveSubRecipe = (subRecipeIngredientId: string) => {
    removeSubRecipeMutation.mutate(subRecipeIngredientId);
  };

  const handleUpdateSubRecipeQuantity = (subRecipeIngredientId: string, quantity: number) => {
    updateSubRecipeQuantityMutation.mutate({ subRecipeIngredientId, quantity });
  };

  const handleRemoveAllIngredients = () => {
    const recipeIngredients = recipe?.ingredients?.filter((ri) => !ri.ingredientDetails.isPackaging) || [];
    recipeIngredients.forEach((ri) => {
      removeIngredientMutation.mutate(ri.id);
    });
  };

  const handleRemoveAllPackaging = () => {
    const packagingItems = recipe?.ingredients?.filter((ri) => ri.ingredientDetails.isPackaging) || [];
    packagingItems.forEach((ri) => {
      removeIngredientMutation.mutate(ri.id);
    });
  };

  const handleRemoveAllSubRecipes = () => {
    const subRecipes = recipe?.subRecipes || [];
    subRecipes.forEach((sr) => {
      removeSubRecipeMutation.mutate(sr.id);
    });
  };

  const handleStartEditMenuPrice = () => {
    setMenuPriceInput(recipe?.menuPrice?.toString() || "");
    setIsEditingMenuPrice(true);
  };

  const handleSaveMenuPrice = () => {
    const value = parseFloat(menuPriceInput);
    if (menuPriceInput === "" || menuPriceInput.trim() === "") {
      updateMenuPriceMutation.mutate(null);
    } else if (!isNaN(value) && value >= 0) {
      updateMenuPriceMutation.mutate(value);
    } else {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
    }
  };

  const handleCancelEditMenuPrice = () => {
    setIsEditingMenuPrice(false);
    setMenuPriceInput("");
  };

  const handleStartEditServings = () => {
    setServingsInput(recipe?.servings?.toString() || "1");
    setIsEditingServings(true);
  };

  const handleSaveServings = () => {
    const value = parseFloat(servingsInput);
    if (!isNaN(value) && value > 0) {
      updateServingsMutation.mutate(value);
    } else {
      toast({
        title: "Invalid Servings",
        description: "Please enter a positive number",
        variant: "destructive",
      });
    }
  };

  const handleCancelEditServings = () => {
    setIsEditingServings(false);
    setServingsInput("");
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
  const displayCategory = recipeCategoryLabels[recipe.category as RecipeCategory] || recipe.category;

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
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") handleCancelEditName();
                  }}
                  className="h-10 text-2xl font-bold w-64"
                  placeholder="Recipe name"
                  autoFocus
                  data-testid="input-recipe-name"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600"
                  onClick={handleSaveName}
                  disabled={updateNameMutation.isPending}
                  data-testid="button-save-name"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={handleCancelEditName}
                  disabled={updateNameMutation.isPending}
                  data-testid="button-cancel-name"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 group cursor-pointer"
                onClick={handleStartEditName}
              >
                <h1 className="text-3xl font-bold tracking-tight" data-testid="text-recipe-name">{recipe.name}</h1>
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            {isEditingCategory ? (
              <Select
                defaultValue={recipe.category}
                onValueChange={(value) => updateCategoryMutation.mutate(value as RecipeCategory)}
                disabled={updateCategoryMutation.isPending}
              >
                <SelectTrigger 
                  className="h-8 w-[160px]"
                  data-testid="select-recipe-category"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recipeCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {recipeCategoryLabels[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div 
                className="flex items-center gap-1 group cursor-pointer"
                onClick={() => setIsEditingCategory(true)}
              >
                <Badge variant="outline" data-testid="badge-recipe-category">
                  {displayCategory}
                </Badge>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
          {recipe.description && (
            <p className="text-muted-foreground mt-2" data-testid="text-recipe-description">
              {recipe.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1">
            {isEditingServings ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={servingsInput}
                  onChange={(e) => setServingsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveServings();
                    if (e.key === "Escape") handleCancelEditServings();
                  }}
                  className="h-8 w-20"
                  placeholder="1"
                  autoFocus
                  data-testid="input-servings"
                />
                <span className="text-muted-foreground text-sm">serving{parseFloat(servingsInput) !== 1 ? "s" : ""}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600"
                  onClick={handleSaveServings}
                  disabled={updateServingsMutation.isPending}
                  data-testid="button-save-servings"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={handleCancelEditServings}
                  disabled={updateServingsMutation.isPending}
                  data-testid="button-cancel-servings"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center gap-1 group cursor-pointer text-muted-foreground"
                onClick={handleStartEditServings}
              >
                <span data-testid="text-recipe-servings">
                  {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
                </span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            <span className="text-muted-foreground">• ${costPerServing.toFixed(2)} per serving</span>
          </div>
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
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Menu Price
            </CardTitle>
            {!isEditingMenuPrice && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleStartEditMenuPrice}
                data-testid="button-edit-menu-price"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditingMenuPrice ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={menuPriceInput}
                    onChange={(e) => setMenuPriceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveMenuPrice();
                      if (e.key === "Escape") handleCancelEditMenuPrice();
                    }}
                    className="pl-7 h-8"
                    placeholder="0.00"
                    autoFocus
                    data-testid="input-menu-price"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600"
                  onClick={handleSaveMenuPrice}
                  disabled={updateMenuPriceMutation.isPending}
                  data-testid="button-save-menu-price"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={handleCancelEditMenuPrice}
                  disabled={updateMenuPriceMutation.isPending}
                  data-testid="button-cancel-menu-price"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : recipe.menuPrice ? (
              <div className="text-2xl font-bold tabular-nums" data-testid="text-recipe-menu-price">
                ${recipe.menuPrice.toFixed(2)}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Badge variant="secondary" className="text-muted-foreground w-fit" data-testid="badge-no-menu-price">
                  Not set
                </Badge>
                <p className="text-xs text-muted-foreground">
                  <DollarSign className="h-3 w-3 inline mr-1" />
                  Click edit to add
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
        allRecipes={allRecipes}
        currentRecipeId={id!}
        subRecipes={recipe.subRecipes || []}
        onAddSubRecipe={handleAddSubRecipe}
        onRemoveSubRecipe={handleRemoveSubRecipe}
        onUpdateSubRecipeQuantity={handleUpdateSubRecipeQuantity}
        onRemoveAllIngredients={handleRemoveAllIngredients}
        onRemoveAllPackaging={handleRemoveAllPackaging}
        onRemoveAllSubRecipes={handleRemoveAllSubRecipes}
      />
    </div>
  );
}
