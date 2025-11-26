import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DensityHeuristic } from "@shared/schema";

export default function DensitiesPage() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editValues, setEditValues] = useState<Partial<DensityHeuristic>>({});
  const [newDensity, setNewDensity] = useState({ ingredientName: "", gramsPerMilliliter: "", category: "", notes: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const { data: densities = [], isLoading } = useQuery<DensityHeuristic[]>({
    queryKey: ["/api/density-heuristics"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/density-heuristics", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/density-heuristics"] });
      setIsCreating(false);
      setNewDensity({ ingredientName: "", gramsPerMilliliter: "", category: "", notes: "" });
      toast({
        title: "Success",
        description: "New density added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create density",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation<DensityHeuristic, Error, { id: string; updates: Partial<DensityHeuristic> }>({
    mutationFn: async ({ id, updates }) => {
      const response = await apiRequest("PATCH", `/api/density-heuristics/${id}`, updates);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/density-heuristics"] });
      setEditingId(null);
      setEditValues({});
      toast({
        title: "Success",
        description: "Density updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update density",
        variant: "destructive",
      });
    },
  });

  const filteredDensities = densities.filter((d) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      d.ingredientName.toLowerCase().includes(searchLower) ||
      (d.category && d.category.toLowerCase().includes(searchLower))
    );
  });

  const handleStartEdit = (density: DensityHeuristic) => {
    setEditingId(density.id);
    setEditValues({ ...density });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleSaveEdit = () => {
    if (editingId && editValues.gramsPerMilliliter !== undefined) {
      updateMutation.mutate({
        id: editingId,
        updates: {
          gramsPerMilliliter: editValues.gramsPerMilliliter,
          category: editValues.category,
          notes: editValues.notes,
        },
      });
    }
  };

  const handleCreateDensity = () => {
    const density = parseFloat(newDensity.gramsPerMilliliter);
    if (!newDensity.ingredientName.trim() || !density || isNaN(density)) {
      toast({
        title: "Validation Error",
        description: "Please enter ingredient name and valid density value",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      ingredientName: newDensity.ingredientName.trim(),
      gramsPerMilliliter: density,
      category: newDensity.category || null,
      notes: newDensity.notes || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading densities...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ingredient Densities</h1>
        <p className="text-muted-foreground mt-1">
          Browse and edit reference densities for common ingredients. These values help calculate accurate recipe costs when converting between volume and weight.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Density Reference Table</CardTitle>
          <CardDescription>
            {filteredDensities.length} ingredients • Measured in grams per milliliter (g/mL)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by ingredient name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-densities"
              />
              <Button 
                size="icon" 
                variant="outline" 
                onClick={() => setIsCreating(!isCreating)}
                data-testid="button-add-density"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {isCreating && (
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-12 gap-4">
                    <Input
                      placeholder="Ingredient name (e.g., Mayo, Pesto)"
                      value={newDensity.ingredientName}
                      onChange={(e) => setNewDensity({ ...newDensity, ingredientName: e.target.value })}
                      className="col-span-3"
                      data-testid="input-new-ingredient-name"
                    />
                    <Input
                      placeholder="Category (e.g., Condiment)"
                      value={newDensity.category}
                      onChange={(e) => setNewDensity({ ...newDensity, category: e.target.value })}
                      className="col-span-2"
                      data-testid="input-new-category"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Density (g/mL)"
                      value={newDensity.gramsPerMilliliter}
                      onChange={(e) => setNewDensity({ ...newDensity, gramsPerMilliliter: e.target.value })}
                      className="col-span-2"
                      data-testid="input-new-density-value"
                    />
                    <Input
                      placeholder="Notes (optional)"
                      value={newDensity.notes}
                      onChange={(e) => setNewDensity({ ...newDensity, notes: e.target.value })}
                      className="col-span-3"
                      data-testid="input-new-notes"
                    />
                    <div className="col-span-2 flex gap-2">
                      <Button
                        onClick={handleCreateDensity}
                        disabled={createMutation.isPending}
                        className="flex-1"
                        data-testid="button-save-new-density"
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsCreating(false)}
                        className="flex-1"
                        data-testid="button-cancel-new-density"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-4 p-3 bg-muted font-medium text-sm sticky top-0 z-10">
                <div className="col-span-4">Ingredient</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">Density (g/mL)</div>
                <div className="col-span-3">Notes</div>
                <div className="col-span-1">Actions</div>
              </div>

              {filteredDensities.length > 0 ? (
                <div className="divide-y">
                  {filteredDensities.map((density) => (
                    <div
                      key={density.id}
                      className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-muted/50"
                      data-testid={`density-row-${density.id}`}
                    >
                      {editingId === density.id ? (
                        <>
                          <Input
                            value={editValues.ingredientName || ""}
                            onChange={(e) =>
                              setEditValues({ ...editValues, ingredientName: e.target.value })
                            }
                            className="col-span-4 h-8"
                            data-testid={`input-ingredient-name-${density.id}`}
                            disabled
                          />
                          <Input
                            value={editValues.category || ""}
                            onChange={(e) =>
                              setEditValues({ ...editValues, category: e.target.value })
                            }
                            placeholder="Category"
                            className="col-span-2 h-8"
                            data-testid={`input-category-${density.id}`}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.gramsPerMilliliter || ""}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                gramsPerMilliliter: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="col-span-2 h-8"
                            data-testid={`input-density-value-${density.id}`}
                          />
                          <Input
                            value={editValues.notes || ""}
                            onChange={(e) =>
                              setEditValues({ ...editValues, notes: e.target.value })
                            }
                            placeholder="Notes"
                            className="col-span-2 h-8"
                            data-testid={`input-notes-${density.id}`}
                          />
                          <div className="col-span-1 flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={handleSaveEdit}
                              disabled={updateMutation.isPending}
                              data-testid={`button-save-edit-${density.id}`}
                            >
                              ✓
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={handleCancelEdit}
                              data-testid={`button-cancel-edit-${density.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="col-span-4">
                            <span className="font-medium">{density.ingredientName}</span>
                          </div>
                          <div className="col-span-2">
                            {density.category ? (
                              <Badge variant="secondary" className="text-xs">
                                {density.category}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </div>
                          <div className="col-span-2">
                            <span className="font-mono text-sm">{density.gramsPerMilliliter.toFixed(2)}</span>
                          </div>
                          <div className="col-span-3">
                            <span className="text-sm text-muted-foreground">
                              {density.notes || "—"}
                            </span>
                          </div>
                          <div className="col-span-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleStartEdit(density)}
                              data-testid={`button-edit-density-${density.id}`}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground">
                    {searchTerm ? "No densities match your search" : "No densities available"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About Densities</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Ingredient densities are essential for accurate recipe costing when converting between volume and weight measurements.
          </p>
          <p>
            This reference table contains standard densities for common cafe ingredients. You can edit these values if you need to use different measurements specific to your suppliers.
          </p>
          <p>
            When creating recipes, the system uses these densities to calculate precise costs for ingredients measured in cups, tablespoons, or other volume-based units.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
