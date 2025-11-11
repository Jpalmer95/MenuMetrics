import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { RecipesTable } from "@/components/recipes-table";
import { RecipeFormDialog } from "@/components/recipe-form-dialog";
import type { Recipe, InsertRecipe } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function RecipesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const createMutation = useMutation<Recipe, Error, InsertRecipe>({
    mutationFn: async (data: InsertRecipe) => {
      const response = await apiRequest("POST", "/api/recipes", data);
      return await response.json();
    },
    onSuccess: (newRecipe: Recipe) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setIsFormOpen(false);
      setLocation(`/recipes/${newRecipe.id}`);
      toast({
        title: "Success",
        description: "Recipe created successfully. Now add ingredients!",
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

  const handleSubmit = (data: InsertRecipe) => {
    if (editingRecipe) {
      updateMutation.mutate({ id: editingRecipe.id, data });
    } else {
      createMutation.mutate(data);
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

  const handleViewDetails = (recipe: Recipe) => {
    setLocation(`/recipes/${recipe.id}`);
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

      <RecipesTable
        recipes={recipes}
        onEdit={handleEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
        onAddNew={handleAddNew}
        onViewDetails={handleViewDetails}
      />

      <RecipeFormDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingRecipe(undefined);
        }}
        onSubmit={handleSubmit}
        recipe={editingRecipe}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
