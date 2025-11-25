import { useState } from "react";
import { Trash2, Plus, Search, Check, X, PackagePlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Ingredient, InsertIngredient, MeasurementUnit } from "@shared/schema";
import { measurementUnits } from "@shared/schema";
import { format } from "date-fns";
import { calculateCostPerUnit } from "@shared/cost-calculator";

interface IngredientsTableProps {
  ingredients: Ingredient[];
  onUpdate: (id: string, data: InsertIngredient) => void;
  onDelete: (id: string) => void;
  onCreate: (data: InsertIngredient) => void;
  onAddNew: () => void;
}

export function IngredientsTable({
  ingredients,
  onUpdate,
  onDelete,
  onCreate,
  onAddNew,
}: IngredientsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof Ingredient | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<InsertIngredient>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newIngredient, setNewIngredient] = useState<Partial<InsertIngredient>>({
    isPackaging: false,
  });
  const [packagingFilter, setPackagingFilter] = useState<"all" | "ingredients" | "packaging">("all");

  const filteredIngredients = ingredients.filter(
    (ing) => {
      // Apply search filter
      const matchesSearch =
        ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ing.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Apply packaging filter
      const matchesPackaging =
        packagingFilter === "all" ||
        (packagingFilter === "packaging" && ing.isPackaging) ||
        (packagingFilter === "ingredients" && !ing.isPackaging);
      
      return matchesSearch && matchesPackaging;
    }
  );

  const sortedIngredients = [...filteredIngredients].sort((a, b) => {
    if (!sortColumn) return 0;
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    
    // Handle null values
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1; // null values go to the end
    if (bVal === null) return -1;
    
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (column: keyof Ingredient) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const startEdit = (ingredient: Ingredient) => {
    setEditingId(ingredient.id);
    setEditValues({
      name: ingredient.name,
      category: ingredient.category,
      store: ingredient.store || "",
      purchaseQuantity: ingredient.purchaseQuantity,
      purchaseUnit: ingredient.purchaseUnit,
      purchaseCost: ingredient.purchaseCost,
      isPackaging: ingredient.isPackaging,
      pricePerUnit: ingredient.pricePerUnit ?? undefined,
      gramsPerMilliliter: ingredient.gramsPerMilliliter ?? undefined,
      densitySource: ingredient.densitySource ?? undefined,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = () => {
    if (editingId && editValues.name && editValues.category && editValues.purchaseQuantity && editValues.purchaseUnit && editValues.purchaseCost !== undefined) {
      // Get the original ingredient to check if density was changed
      const originalIngredient = ingredients.find(ing => ing.id === editingId);
      let updateData = { ...editValues } as InsertIngredient;
      
      // If density was manually changed, update the source
      if (originalIngredient && 
          editValues.gramsPerMilliliter !== undefined && 
          editValues.gramsPerMilliliter !== originalIngredient.gramsPerMilliliter) {
        updateData.densitySource = "Manual";
      }
      
      // Auto-calculate pricePerUnit if unit type is "units"
      if (editValues.purchaseUnit === "units" && editValues.purchaseQuantity > 0) {
        updateData.pricePerUnit = editValues.purchaseCost / editValues.purchaseQuantity;
      }
      
      onUpdate(editingId, updateData);
      setEditingId(null);
      setEditValues({});
    }
  };

  const startAddNew = () => {
    setIsAddingNew(true);
    setNewIngredient({ isPackaging: false });
  };

  const cancelAddNew = () => {
    setIsAddingNew(false);
    setNewIngredient({ isPackaging: false });
  };

  const saveNewIngredient = () => {
    if (
      newIngredient.name &&
      newIngredient.category &&
      newIngredient.purchaseQuantity &&
      newIngredient.purchaseQuantity > 0 &&
      newIngredient.purchaseUnit &&
      newIngredient.purchaseCost !== undefined &&
      newIngredient.purchaseCost >= 0
    ) {
      // Set density source to "Manual" if density was provided
      let ingredientData = { ...newIngredient } as InsertIngredient;
      if (ingredientData.gramsPerMilliliter !== undefined) {
        ingredientData.densitySource = "Manual";
      }
      
      // Auto-calculate pricePerUnit if unit type is "units"
      if (newIngredient.purchaseUnit === "units" && newIngredient.purchaseQuantity > 0) {
        ingredientData.pricePerUnit = newIngredient.purchaseCost / newIngredient.purchaseQuantity;
      }
      
      onCreate(ingredientData);
      setIsAddingNew(false);
      setNewIngredient({ isPackaging: false });
    }
  };

  // Calculate preview costs for the new ingredient using shared cost calculator
  // This ensures preview calculations exactly match what the backend will calculate
  const calculatePreviewCosts = () => {
    if (
      !newIngredient.purchaseQuantity ||
      newIngredient.purchaseCost === undefined ||
      !newIngredient.purchaseUnit
    ) {
      return { costPerOz: null, costPerGram: null };
    }

    try {
      const options = newIngredient.gramsPerMilliliter
        ? { densityGramsPerMl: newIngredient.gramsPerMilliliter }
        : undefined;

      // Use shared cost calculator to match backend logic exactly
      const costPerOz = calculateCostPerUnit(
        newIngredient.purchaseQuantity,
        newIngredient.purchaseUnit as MeasurementUnit,
        newIngredient.purchaseCost,
        "ounces",
        options
      );

      const costPerGram = calculateCostPerUnit(
        newIngredient.purchaseQuantity,
        newIngredient.purchaseUnit as MeasurementUnit,
        newIngredient.purchaseCost,
        "grams",
        options
      );

      return { costPerOz, costPerGram };
    } catch {
      return { costPerOz: null, costPerGram: null };
    }
  };

  const previewCosts = isAddingNew ? calculatePreviewCosts() : { costPerOz: null, costPerGram: null };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search ingredients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-ingredients"
            />
          </div>
          <Select value={packagingFilter} onValueChange={(val) => setPackagingFilter(val as typeof packagingFilter)}>
            <SelectTrigger className="w-40" data-testid="select-packaging-filter">
              <SelectValue placeholder="Filter by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="ingredients">Ingredients Only</SelectItem>
              <SelectItem value="packaging">Packaging Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={startAddNew} data-testid="button-add-row" disabled={isAddingNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add New Row
          </Button>
          <Button onClick={onAddNew} variant="outline" data-testid="button-add-ingredient">
            <PackagePlus className="h-4 w-4 mr-2" />
            Advanced Form
          </Button>
        </div>
      </div>

      <div className="border rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead
                className="cursor-pointer font-semibold"
                onClick={() => handleSort("name")}
              >
                Ingredient Name
                {sortColumn === "name" && (
                  <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </TableHead>
              <TableHead
                className="cursor-pointer font-semibold"
                onClick={() => handleSort("category")}
              >
                Category
                {sortColumn === "category" && (
                  <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </TableHead>
              <TableHead className="font-semibold text-center">Packaging</TableHead>
              <TableHead className="font-semibold">Store</TableHead>
              <TableHead className="font-semibold">Purchase Info</TableHead>
              <TableHead
                className="text-right cursor-pointer font-semibold"
                onClick={() => handleSort("purchaseCost")}
              >
                Total Cost
                {sortColumn === "purchaseCost" && (
                  <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </TableHead>
              <TableHead className="text-right font-semibold">Per Oz</TableHead>
              <TableHead className="text-right font-semibold">Per Gram</TableHead>
              <TableHead className="text-right font-semibold">Price Per Unit</TableHead>
              <TableHead className="text-right font-semibold">Density (g/mL)</TableHead>
              <TableHead className="font-semibold">Last Updated</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAddingNew && (
              <TableRow className="bg-accent/20">
                <TableCell>
                  <Input
                    placeholder="Ingredient name"
                    value={newIngredient.name || ""}
                    onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                    className="h-8"
                    data-testid="input-new-name"
                    autoFocus
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Category"
                    value={newIngredient.category || ""}
                    onChange={(e) => setNewIngredient({ ...newIngredient, category: e.target.value })}
                    className="h-8"
                    data-testid="input-new-category"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={newIngredient.isPackaging || false}
                    onCheckedChange={(checked) => setNewIngredient({ ...newIngredient, isPackaging: !!checked })}
                    data-testid="checkbox-new-packaging"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="e.g., HEB"
                    value={newIngredient.store || ""}
                    onChange={(e) => setNewIngredient({ ...newIngredient, store: e.target.value })}
                    className="h-8"
                    data-testid="input-new-store"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Qty"
                      value={newIngredient.purchaseQuantity || ""}
                      onChange={(e) =>
                        setNewIngredient({
                          ...newIngredient,
                          purchaseQuantity: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8 w-20"
                      data-testid="input-new-quantity"
                    />
                    <Select
                      value={newIngredient.purchaseUnit}
                      onValueChange={(val) =>
                        setNewIngredient({ ...newIngredient, purchaseUnit: val })
                      }
                    >
                      <SelectTrigger className="h-8 w-28" data-testid="select-new-unit">
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {measurementUnits.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Total cost"
                    value={newIngredient.purchaseCost !== undefined ? newIngredient.purchaseCost : ""}
                    onChange={(e) =>
                      setNewIngredient({
                        ...newIngredient,
                        purchaseCost: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-8 text-right"
                    data-testid="input-new-cost"
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {previewCosts.costPerOz !== null
                    ? `$${previewCosts.costPerOz.toFixed(3)}`
                    : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {previewCosts.costPerGram !== null
                    ? `$${previewCosts.costPerGram.toFixed(3)}`
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Price/unit"
                    value={newIngredient.pricePerUnit !== undefined ? newIngredient.pricePerUnit : ""}
                    onChange={(e) =>
                      setNewIngredient({
                        ...newIngredient,
                        pricePerUnit: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="h-8 text-right w-24"
                    data-testid="input-new-price-per-unit"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Optional"
                    value={newIngredient.gramsPerMilliliter !== undefined ? newIngredient.gramsPerMilliliter : ""}
                    onChange={(e) =>
                      setNewIngredient({
                        ...newIngredient,
                        gramsPerMilliliter: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="h-8 text-right w-24"
                    data-testid="input-new-density"
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  New
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={saveNewIngredient}
                      data-testid="button-save-new"
                    >
                      <Check className="h-4 w-4 text-success" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={cancelAddNew}
                      data-testid="button-cancel-new"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {sortedIngredients.length === 0 && !isAddingNew ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  {searchTerm
                    ? "No ingredients found matching your search."
                    : "No ingredients yet. Add your first ingredient to get started."}
                </TableCell>
              </TableRow>
            ) : (
              sortedIngredients.map((ingredient) => {
                const isEditing = editingId === ingredient.id;
                return (
                  <TableRow key={ingredient.id} className="hover:bg-muted/30" onDoubleClick={() => startEdit(ingredient)}>
                    <TableCell data-testid={`text-ingredient-name-${ingredient.id}`}>
                      {isEditing ? (
                        <Input
                          value={editValues.name || ""}
                          onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                          className="h-8"
                          data-testid={`input-edit-name-${ingredient.id}`}
                        />
                      ) : (
                        <span className="font-medium">{ingredient.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editValues.category || ""}
                          onChange={(e) => setEditValues({ ...editValues, category: e.target.value })}
                          className="h-8"
                          data-testid={`input-edit-category-${ingredient.id}`}
                        />
                      ) : (
                        <Badge variant="secondary" className="font-normal">
                          {ingredient.category}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isEditing ? (editValues.isPackaging || false) : ingredient.isPackaging}
                        onCheckedChange={(checked) => {
                          if (isEditing) {
                            setEditValues({ ...editValues, isPackaging: !!checked });
                          } else {
                            // Quick toggle for non-editing mode - preserve all existing fields
                            onUpdate(ingredient.id, { 
                              name: ingredient.name,
                              category: ingredient.category,
                              purchaseQuantity: ingredient.purchaseQuantity,
                              purchaseUnit: ingredient.purchaseUnit,
                              purchaseCost: ingredient.purchaseCost,
                              isPackaging: !!checked,
                              store: ingredient.store ?? undefined,
                              pricePerUnit: ingredient.pricePerUnit ?? undefined,
                              gramsPerMilliliter: ingredient.gramsPerMilliliter ?? undefined,
                              densitySource: ingredient.densitySource ?? undefined,
                            });
                          }
                        }}
                        data-testid={`checkbox-packaging-${ingredient.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editValues.store || ""}
                          onChange={(e) => setEditValues({ ...editValues, store: e.target.value })}
                          placeholder="e.g., HEB"
                          className="h-8"
                          data-testid={`input-edit-store-${ingredient.id}`}
                        />
                      ) : (
                        <span className="text-muted-foreground">{ingredient.store || "-"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.purchaseQuantity || ""}
                            onChange={(e) => setEditValues({ ...editValues, purchaseQuantity: parseFloat(e.target.value) })}
                            placeholder="Qty"
                            className="h-8 w-20"
                            data-testid={`input-edit-quantity-${ingredient.id}`}
                          />
                          <Select value={editValues.purchaseUnit || ingredient.purchaseUnit} onValueChange={(val) => setEditValues({ ...editValues, purchaseUnit: val })}>
                            <SelectTrigger className="h-8 w-28" data-testid={`select-edit-unit-${ingredient.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {measurementUnits.map((unit) => (
                                <SelectItem key={unit} value={unit}>
                                  {unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          {ingredient.purchaseQuantity} {ingredient.purchaseUnit}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editValues.purchaseCost !== undefined ? editValues.purchaseCost : ""}
                          onChange={(e) => setEditValues({ ...editValues, purchaseCost: parseFloat(e.target.value) })}
                          className="h-8 text-right"
                          data-testid={`input-edit-cost-${ingredient.id}`}
                        />
                      ) : (
                        `$${ingredient.purchaseCost.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {ingredient.costPerOunce ? `$${ingredient.costPerOunce.toFixed(3)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {ingredient.costPerGram ? `$${ingredient.costPerGram.toFixed(3)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-price-per-unit-${ingredient.id}`}>
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Price/unit"
                          value={editValues.pricePerUnit !== undefined ? editValues.pricePerUnit : ""}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              pricePerUnit: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          className="h-8 text-right w-24"
                          data-testid={`input-edit-price-per-unit-${ingredient.id}`}
                        />
                      ) : (
                        <span className="text-sm tabular-nums">
                          {ingredient.pricePerUnit 
                            ? `$${ingredient.pricePerUnit.toFixed(2)}`
                            : <span className="text-muted-foreground">-</span>
                          }
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-density-${ingredient.id}`}>
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Optional"
                          value={editValues.gramsPerMilliliter !== undefined ? editValues.gramsPerMilliliter : ""}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              gramsPerMilliliter: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          className="h-8 text-right w-24"
                          data-testid={`input-edit-density-${ingredient.id}`}
                        />
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-sm tabular-nums">
                            {ingredient.gramsPerMilliliter 
                              ? ingredient.gramsPerMilliliter.toFixed(2)
                              : <span className="text-muted-foreground">-</span>
                            }
                          </span>
                          {ingredient.gramsPerMilliliter && ingredient.densitySource?.includes("AI-estimated") && (
                            <span 
                              title={ingredient.densitySource}
                              data-testid={`icon-ai-density-${ingredient.id}`}
                            >
                              <Sparkles className="h-3 w-3 text-primary" />
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(ingredient.lastUpdated), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={saveEdit}
                            data-testid={`button-save-edit-${ingredient.id}`}
                          >
                            <Check className="h-4 w-4 text-success" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={cancelEdit}
                            data-testid={`button-cancel-edit-${ingredient.id}`}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(ingredient)}
                            data-testid={`button-edit-ingredient-${ingredient.id}`}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(ingredient.id)}
                            data-testid={`button-delete-ingredient-${ingredient.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {sortedIngredients.length} of {ingredients.length} ingredients • Double-click any row to edit inline • Cost per unit is auto-calculated
      </div>
    </div>
  );
}
