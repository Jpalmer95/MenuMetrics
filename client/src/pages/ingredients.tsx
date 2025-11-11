import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IngredientsTable } from "@/components/ingredients-table";
import { IngredientFormDialog } from "@/components/ingredient-form-dialog";
import { ExcelImportDialog } from "@/components/excel-import-dialog";
import type { Ingredient, InsertIngredient } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function IngredientsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | undefined>();
  const { toast } = useToast();

  const { data: ingredients = [], isLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertIngredient) =>
      apiRequest("POST", "/api/ingredients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      setIsFormOpen(false);
      toast({
        title: "Success",
        description: "Ingredient added successfully",
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertIngredient }) =>
      apiRequest("PATCH", `/api/ingredients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      setIsFormOpen(false);
      setEditingIngredient(undefined);
      toast({
        title: "Success",
        description: "Ingredient updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update ingredient",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ingredients/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      toast({
        title: "Success",
        description: "Ingredient deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete ingredient",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({ file, mapping }: { file: File; mapping: Record<string, string> }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));
      const response = await fetch("/api/ingredients/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Import failed");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      setIsImportOpen(false);
      toast({
        title: "Success",
        description: `Imported ${data.count} ingredients successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to import ingredients",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertIngredient) => {
    if (editingIngredient) {
      updateMutation.mutate({ id: editingIngredient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setEditingIngredient(undefined);
    setIsFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading ingredients...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ingredients Database</h1>
          <p className="text-muted-foreground mt-1">
            Manage your ingredient inventory and costs
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setIsImportOpen(true)}
          data-testid="button-import-excel"
        >
          <Upload className="h-4 w-4 mr-2" />
          Import Excel
        </Button>
      </div>

      <IngredientsTable
        ingredients={ingredients}
        onUpdate={(id, data) => updateMutation.mutate({ id, data })}
        onDelete={(id) => deleteMutation.mutate(id)}
        onAddNew={handleAddNew}
      />

      <IngredientFormDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingIngredient(undefined);
        }}
        onSubmit={handleSubmit}
        ingredient={editingIngredient}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <ExcelImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={(file, mapping) => importMutation.mutate({ file, mapping })}
        isLoading={importMutation.isPending}
      />
    </div>
  );
}
