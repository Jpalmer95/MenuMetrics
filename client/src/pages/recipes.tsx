import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { RecipesTable } from "@/components/recipes-table";
import { AddRecipeWithIngredientsDialog } from "@/components/add-recipe-with-ingredients-dialog";
import { ImportRecipeDialog } from "@/components/import-recipe-dialog";
import { BulkImportRecipeDialog } from "@/components/bulk-import-recipe-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { Recipe, InsertRecipe, Ingredient, RecipeCategory, RecipeWithIngredients, MeasurementUnit } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { calculateIngredientCost, checkDensityWarning } from "@/lib/unit-conversions";
import { AlertTriangle } from "lucide-react";

interface RecipeIngredientRow {
  tempId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
}

interface RecipeIssue {
  recipeId: string;
  recipeName: string;
  issues: Array<{
    type: "incompatible_unit" | "zero_cost";
    ingredientName: string;
    message: string;
  }>;
}

export default function RecipesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: ingredients = [] } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const { data: recipesWithIngredients = [] } = useQuery<RecipeWithIngredients[]>({
    queryKey: ["/api/recipes/with-ingredients"],
  });

  const recipesWithIssues = useMemo(() => {
    const issues: RecipeIssue[] = [];

    for (const recipe of recipesWithIngredients) {
      const recipeIssues: RecipeIssue["issues"] = [];

      for (const ri of recipe.ingredients) {
        const ingredient = ri.ingredientDetails;
        const recipeUnit = ri.unit as MeasurementUnit;

        const warning = checkDensityWarning(ingredient, recipeUnit);
        if (warning.needsWarning && warning.warningType === "incompatible") {
          recipeIssues.push({
            type: "incompatible_unit",
            ingredientName: ingredient.name,
            message: `Incompatible units: ${ingredient.purchaseUnit} cannot convert to ${ri.unit}`,
          });
          continue;
        }

        const cost = calculateIngredientCost(ingredient, ri.quantity, recipeUnit);
        if (cost === 0) {
          recipeIssues.push({
            type: "zero_cost",
            ingredientName: ingredient.name,
            message: `Cost is $0.00 - check ingredient pricing or unit compatibility`,
          });
        }
      }

      if (recipeIssues.length > 0) {
        issues.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          issues: recipeIssues,
        });
      }
    }

    return issues;
  }, [recipesWithIngredients]);

  const createMutation = useMutation<Recipe, Error, { recipe: InsertRecipe; ingredients: RecipeIngredientRow[] }>({
    mutationFn: async ({ recipe, ingredients: recipeIngredients }) => {
      // Create recipe first
      const recipeResponse = await apiRequest("POST", "/api/recipes", recipe);
      const newRecipe = await recipeResponse.json();

      // Add ingredients
      for (const ri of recipeIngredients) {
        await apiRequest("POST", "/api/recipes/" + newRecipe.id + "/ingredients", {
          ingredientId: ri.ingredientId,
          quantity: ri.quantity,
          unit: ri.unit,
        });
      }

      return newRecipe;
    },
    onSuccess: (newRecipe: Recipe) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/with-ingredients"] });
      setIsFormOpen(false);
      setLocation(`/recipes/${newRecipe.id}`);
      toast({
        title: "Success",
        description: "Recipe created successfully with ingredients!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create recipe",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation<Recipe, Error, { id: string; data: InsertRecipe }>({
    mutationFn: async ({ id, data }: { id: string; data: InsertRecipe }) => {
      const response = await apiRequest("PATCH", `/api/recipes/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/with-ingredients"] });
      setIsFormOpen(false);
      setEditingRecipe(undefined);
      toast({
        title: "Success",
        description: "Recipe updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update recipe",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/recipes/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/with-ingredients"] });
      toast({
        title: "Success",
        description: "Recipe deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete recipe",
        variant: "destructive",
      });
    },
  });

  const updateMenuPriceMutation = useMutation<Recipe, Error, { id: string; menuPrice: number | null }>({
    mutationFn: async ({ id, menuPrice }) => {
      const response = await apiRequest("PATCH", `/api/recipes/${id}/pricing`, { menuPrice });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
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

  const updateCategoryMutation = useMutation<Recipe, Error, { id: string; category: RecipeCategory }>({
    mutationFn: async ({ id, category }) => {
      const response = await apiRequest("PATCH", `/api/recipes/${id}/category`, { category });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
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

  const duplicateMutation = useMutation<Recipe, Error, { id: string; name: string }>({
    mutationFn: async ({ id, name }) => {
      const response = await apiRequest("POST", `/api/recipes/${id}/duplicate`, { name });
      return await response.json();
    },
    onSuccess: (newRecipe) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/with-ingredients"] });
      setLocation(`/recipes/${newRecipe.id}`);
      toast({
        title: "Success",
        description: `Recipe duplicated as "${newRecipe.name}"`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to duplicate recipe",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertRecipe, recipeIngredients: RecipeIngredientRow[]) => {
    if (editingRecipe) {
      updateMutation.mutate({ id: editingRecipe.id, data });
    } else {
      createMutation.mutate({ recipe: data, ingredients: recipeIngredients });
    }
  };

  const handleEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setEditingRecipe(undefined);
    setIsFormOpen(true);
  };

  const handleImportWithAI = () => {
    setIsImportOpen(true);
  };

  const handleImportRecipe = async (recipeData: any) => {
    try {
      // Use the existing AI create recipe endpoint
      const response = await apiRequest("POST", "/api/ai/create-recipe", recipeData);
      const newRecipe = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/with-ingredients"] });
      setLocation(`/recipes/${newRecipe.id}`);
      toast({
        title: "Recipe Imported",
        description: `"${recipeData.name}" has been added to your recipes.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import recipe. Some ingredients may not be in your database.",
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = (recipe: Recipe) => {
    setLocation(`/recipes/${recipe.id}`);
  };

  const handleBulkImport = () => {
    setIsBulkImportOpen(true);
  };

  const handleExport = () => {
    window.location.href = "/api/recipes/export";
  };

  const handleUpdateMenuPrice = (recipeId: string, menuPrice: number | null) => {
    updateMenuPriceMutation.mutate({ id: recipeId, menuPrice });
  };

  const handleUpdateCategory = (recipeId: string, category: RecipeCategory) => {
    updateCategoryMutation.mutate({ id: recipeId, category });
  };

  const handleDuplicate = (recipeId: string, newName: string) => {
    duplicateMutation.mutate({ id: recipeId, name: newName });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading recipes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recipes</h1>
        <p className="text-muted-foreground mt-1">
          Manage your recipes and track costs automatically
        </p>
      </div>

      {recipesWithIssues.length > 0 && (
        <Alert variant="destructive" data-testid="alert-recipe-issues">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Recipe Issues Detected</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {recipesWithIssues.map((recipe) => (
                <div key={recipe.recipeId} className="text-sm">
                  <Link
                    href={`/recipes/${recipe.recipeId}`}
                    className="font-medium underline hover:no-underline"
                    data-testid={`link-recipe-issue-${recipe.recipeId}`}
                  >
                    {recipe.recipeName}
                  </Link>
                  <span className="text-muted-foreground">
                    : {recipe.issues.map((issue) => (
                      <span key={issue.ingredientName} className="mr-2">
                        {issue.ingredientName} ({issue.type === "incompatible_unit" ? "incompatible units" : "$0.00 cost"})
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <RecipesTable
        recipes={recipes}
        onEdit={handleEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
        onAddNew={handleAddNew}
        onImportWithAI={handleImportWithAI}
        onBulkImport={handleBulkImport}
        onExport={handleExport}
        onViewDetails={handleViewDetails}
        onUpdateMenuPrice={handleUpdateMenuPrice}
        isUpdatingMenuPrice={updateMenuPriceMutation.isPending}
        onUpdateCategory={handleUpdateCategory}
        isUpdatingCategory={updateCategoryMutation.isPending}
        onDuplicate={handleDuplicate}
        isDuplicating={duplicateMutation.isPending}
      />

      <AddRecipeWithIngredientsDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingRecipe(undefined);
        }}
        onSubmit={handleSubmit}
        ingredients={ingredients}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <ImportRecipeDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleImportRecipe}
      />

      <BulkImportRecipeDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
          toast({
            title: "Import Complete",
            description: "Recipes have been imported successfully. Check the dialog for any errors.",
          });
        }}
      />
    </div>
  );
}
