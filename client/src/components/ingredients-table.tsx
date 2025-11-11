import { useState } from "react";
import { Trash2, Plus, Search, Check, X } from "lucide-react";
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
import type { Ingredient, InsertIngredient } from "@shared/schema";
import { measurementUnits } from "@shared/schema";
import { format } from "date-fns";

interface IngredientsTableProps {
  ingredients: Ingredient[];
  onUpdate: (id: string, data: InsertIngredient) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
}

export function IngredientsTable({
  ingredients,
  onUpdate,
  onDelete,
  onAddNew,
}: IngredientsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof Ingredient | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<InsertIngredient>>({});

  const filteredIngredients = ingredients.filter(
    (ing) =>
      ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ing.category.toLowerCase().includes(searchTerm.toLowerCase())
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
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = () => {
    if (editingId && editValues.name && editValues.category && editValues.purchaseQuantity && editValues.purchaseUnit && editValues.purchaseCost !== undefined) {
      onUpdate(editingId, editValues as InsertIngredient);
      setEditingId(null);
      setEditValues({});
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
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
        <Button onClick={onAddNew} data-testid="button-add-ingredient">
          <Plus className="h-4 w-4 mr-2" />
          Add Ingredient
        </Button>
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
              <TableHead className="font-semibold">Last Updated</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedIngredients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
        Showing {sortedIngredients.length} of {ingredients.length} ingredients • Double-click any row to edit inline
      </div>
    </div>
  );
}
