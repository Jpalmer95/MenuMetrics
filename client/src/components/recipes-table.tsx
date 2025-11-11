import { useState } from "react";
import { Pencil, Trash2, Plus, Search, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Recipe } from "@shared/schema";
import { format } from "date-fns";

interface RecipesTableProps {
  recipes: Recipe[];
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
  onViewDetails: (recipe: Recipe) => void;
}

export function RecipesTable({
  recipes,
  onEdit,
  onDelete,
  onAddNew,
  onViewDetails,
}: RecipesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof Recipe | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const filteredRecipes = recipes.filter((recipe) =>
    recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    if (!sortColumn) return 0;
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (column: keyof Recipe) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const calculateMargin = (totalCost: number) => {
    const recommendedPrice = totalCost * 3;
    return ((recommendedPrice - totalCost) / recommendedPrice) * 100;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-recipes"
          />
        </div>
        <Button onClick={onAddNew} data-testid="button-add-recipe">
          <Plus className="h-4 w-4 mr-2" />
          Add Recipe
        </Button>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead
                className="cursor-pointer font-semibold"
                onClick={() => handleSort("name")}
              >
                Recipe Name
                {sortColumn === "name" && (
                  <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </TableHead>
              <TableHead
                className="text-right cursor-pointer font-semibold"
                onClick={() => handleSort("servings")}
              >
                Servings
                {sortColumn === "servings" && (
                  <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </TableHead>
              <TableHead
                className="text-right cursor-pointer font-semibold"
                onClick={() => handleSort("totalCost")}
              >
                Total Cost
                {sortColumn === "totalCost" && (
                  <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </TableHead>
              <TableHead
                className="text-right cursor-pointer font-semibold"
                onClick={() => handleSort("costPerServing")}
              >
                Cost/Serving
                {sortColumn === "costPerServing" && (
                  <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </TableHead>
              <TableHead className="text-right font-semibold">Margin %</TableHead>
              <TableHead className="font-semibold">Created</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRecipes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {searchTerm
                    ? "No recipes found matching your search."
                    : "No recipes yet. Create your first recipe to get started."}
                </TableCell>
              </TableRow>
            ) : (
              sortedRecipes.map((recipe) => {
                const margin = calculateMargin(recipe.totalCost);
                return (
                  <TableRow
                    key={recipe.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => onViewDetails(recipe)}
                  >
                    <TableCell className="font-medium" data-testid={`text-recipe-name-${recipe.id}`}>
                      <div className="flex items-center gap-2">
                        <ChefHat className="h-4 w-4 text-muted-foreground" />
                        {recipe.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {recipe.servings}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-destructive">
                      ${recipe.totalCost.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      ${recipe.costPerServing.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={margin >= 60 ? "default" : "secondary"}
                        className={
                          margin >= 60
                            ? "bg-success hover:bg-success"
                            : margin >= 50
                            ? "bg-warning hover:bg-warning"
                            : ""
                        }
                      >
                        {margin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(recipe.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(recipe)}
                          data-testid={`button-edit-recipe-${recipe.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(recipe.id)}
                          data-testid={`button-delete-recipe-${recipe.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {sortedRecipes.length} of {recipes.length} recipes
      </div>
    </div>
  );
}
