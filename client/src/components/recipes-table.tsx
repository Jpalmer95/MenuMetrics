import { useState } from "react";
import { Pencil, Trash2, Plus, Search, ChefHat, Sparkles, Upload, Download } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Recipe } from "@shared/schema";
import { calculateProfitMargin, recipeCategories } from "@shared/schema";
import { format } from "date-fns";

interface RecipesTableProps {
  recipes: Recipe[];
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
  onImportWithAI: () => void;
  onBulkImport: () => void;
  onExport: () => void;
  onViewDetails: (recipe: Recipe) => void;
}

export function RecipesTable({
  recipes,
  onEdit,
  onDelete,
  onAddNew,
  onImportWithAI,
  onBulkImport,
  onExport,
  onViewDetails,
}: RecipesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<keyof Recipe | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || recipe.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    if (!sortColumn) return 0;
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return sortDirection === "asc" ? 1 : -1;
    if (bVal === null) return sortDirection === "asc" ? -1 : 1;
    
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-filter-all">All categories</SelectItem>
              {recipeCategories.map((cat) => (
                <SelectItem key={cat} value={cat} data-testid={`option-filter-${cat}`}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={onExport} variant="outline" data-testid="button-export-recipes">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={onBulkImport} variant="outline" data-testid="button-bulk-import">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={onImportWithAI} variant="outline" data-testid="button-import-ai">
            <Sparkles className="h-4 w-4 mr-2" />
            Import with AI
          </Button>
          <Button onClick={onAddNew} data-testid="button-add-recipe">
            <Plus className="h-4 w-4 mr-2" />
            Add Recipe
          </Button>
        </div>
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
                className="cursor-pointer font-semibold"
                onClick={() => handleSort("category")}
              >
                Category
                {sortColumn === "category" && (
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
              <TableHead
                className="text-right cursor-pointer font-semibold"
                onClick={() => handleSort("menuPrice")}
              >
                Menu Price
                {sortColumn === "menuPrice" && (
                  <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </TableHead>
              <TableHead className="text-right font-semibold">Margin %</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRecipes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchTerm || categoryFilter !== "all"
                    ? "No recipes found matching your filters."
                    : "No recipes yet. Create your first recipe to get started."}
                </TableCell>
              </TableRow>
            ) : (
              sortedRecipes.map((recipe) => {
                const margin = calculateProfitMargin(recipe.menuPrice, recipe.costPerServing);
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
                    <TableCell>
                      <Badge variant="outline" data-testid={`badge-category-${recipe.id}`}>
                        {recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      ${recipe.costPerServing.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {recipe.menuPrice ? (
                        `$${recipe.menuPrice.toFixed(2)}`
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground" data-testid={`badge-no-price-${recipe.id}`}>
                          Not set
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {margin !== null ? (
                        <Badge
                          variant={margin >= 60 ? "default" : "secondary"}
                          data-testid={`badge-margin-${recipe.id}`}
                        >
                          {margin.toFixed(1)}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground" data-testid={`badge-no-margin-${recipe.id}`}>
                          -
                        </Badge>
                      )}
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
