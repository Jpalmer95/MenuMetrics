import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, Download, FileSpreadsheet, Sparkles } from "lucide-react";
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
      const hasErrors = data.skipped && data.skipped > 0;
      toast({
        title: hasErrors ? "Import Completed with Warnings" : "Import Successful",
        description: hasErrors 
          ? `Imported ${data.imported} ingredients successfully. Skipped ${data.skipped} rows with errors. Check console for details.`
          : `Successfully imported ${data.imported} ingredients.`,
        variant: hasErrors ? "default" : "default",
      });
      if (hasErrors && data.errors) {
        console.error("Import errors:", data.errors);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to import ingredients",
        variant: "destructive",
      });
    },
  });

  const estimateDensitiesMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ingredients/estimate-densities", {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      toast({
        title: "AI Density Estimation Complete",
        description: data.updated > 0 
          ? `Successfully estimated densities for ${data.updated} of ${data.total} ingredients that needed density values.`
          : data.message || "All ingredients already have density values!",
      });
      if (data.results && data.results.length > 0) {
        console.log("Density estimation results:", data.results);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Density Estimation Failed",
        description: error.message || "Failed to estimate densities. Please try again.",
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

  const handleDownloadTemplate = () => {
    // Download the Excel template
    window.location.href = "/api/ingredients/template";
  };

  const handleExport = () => {
    // Download current ingredients as Excel
    window.location.href = "/api/ingredients/export";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading ingredients...</p>
      </div>
    );
  }

  // Count ingredients missing densities (those that aren't "units" and don't have density)
  const missingDensityCount = ingredients.filter(
    ing => ing.purchaseUnit !== "units" && !ing.gramsPerMilliliter && !ing.isPackaging
  ).length;

  return (
    <div className="space-y-6">
      {missingDensityCount > 0 && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-4 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            <strong>{missingDensityCount}</strong> ingredient{missingDensityCount !== 1 ? "s" : ""} {missingDensityCount === 1 ? "is" : "are"} missing densities.
            These densities improve accuracy for volume↔weight conversions in recipes. Try adding them manually, use the AI density estimator, or check the density reference table.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ingredients Database</h1>
          <p className="text-muted-foreground mt-1">
            Manage your ingredient inventory and costs
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            data-testid="button-download-template"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={ingredients.length === 0}
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => estimateDensitiesMutation.mutate()}
            disabled={ingredients.length === 0 || estimateDensitiesMutation.isPending}
            data-testid="button-estimate-densities"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {estimateDensitiesMutation.isPending ? "Estimating..." : "AI: Add Densities"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsImportOpen(true)}
            data-testid="button-import-excel"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
        </div>
      </div>

      <IngredientsTable
        ingredients={ingredients}
        onUpdate={(id, data) => updateMutation.mutate({ id, data })}
        onDelete={(id) => deleteMutation.mutate(id)}
        onCreate={(data) => createMutation.mutate(data)}
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
