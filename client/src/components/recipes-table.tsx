import { useState } from "react";
import { Pencil, Trash2, Plus, Search, ChefHat, Sparkles, Upload, Download, Check, X, DollarSign, Copy, Package } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Recipe, RecipeCategory } from "@shared/schema";
import { calculateProfitMargin, recipeCategories, recipeCategoryLabels } from "@shared/schema";
import { format } from "date-fns";

interface RecipesTableProps {
  recipes: Recipe[];
  onDelete: (id: string) => void;
  onAddNew: () => void;
  onImportWithAI: () => void;
  onBulkImport: () => void;
  onExport: () => void;
  onViewDetails: (recipe: Recipe) => void;
  onUpdateMenuPrice?: (recipeId: string, menuPrice: number | null) => void;
  isUpdatingMenuPrice?: boolean;
  onUpdateCategory?: (recipeId: string, category: RecipeCategory) => void;
  isUpdatingCategory?: boolean;
  onUpdateName?: (recipeId: string, name: string) => void;
  isUpdatingName?: boolean;
  onTogglePackagingPreset?: (recipeId: string, currentValue: boolean) => void;
  isTogglingPackagingPreset?: boolean;
  onToggleBaseRecipe?: (recipeId: string, currentValue: boolean) => void;
  isTogglingBaseRecipe?: boolean;
  onDuplicate?: (recipeId: string, newName: string) => void;
  isDuplicating?: boolean;
}

export function RecipesTable({
  recipes,
  onDelete,
  onAddNew,
  onImportWithAI,
  onBulkImport,
  onExport,
  onViewDetails,
  onUpdateMenuPrice,
  isUpdatingMenuPrice,
  onUpdateCategory,
  isUpdatingCategory,
  onUpdateName,
  isUpdatingName,
  onTogglePackagingPreset,
  isTogglingPackagingPreset,
  onToggleBaseRecipe,
  isTogglingBaseRecipe,
  onDuplicate,
  isDuplicating,
}: RecipesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<keyof Recipe | "margin" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceInputValue, setPriceInputValue] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameInputValue, setNameInputValue] = useState("");
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateRecipe, setDuplicateRecipe] = useState<Recipe | null>(null);
  const [duplicateName, setDuplicateName] = useState("");

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || recipe.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let aVal: any;
    let bVal: any;
    
    if (sortColumn === "margin") {
      aVal = calculateProfitMargin(a.menuPrice, a.costPerServing);
      bVal = calculateProfitMargin(b.menuPrice, b.costPerServing);
    } else {
      aVal = a[sortColumn];
      bVal = b[sortColumn];
    }
    
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return sortDirection === "asc" ? 1 : -1;
    if (bVal === null) return sortDirection === "asc" ? -1 : 1;
    
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (column: keyof Recipe | "margin") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleStartEditPrice = (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPriceId(recipe.id);
    setPriceInputValue(recipe.menuPrice?.toString() || "");
  };

  const handleSavePrice = (recipeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateMenuPrice) return;
    
    const value = parseFloat(priceInputValue);
    if (priceInputValue === "" || priceInputValue.trim() === "") {
      onUpdateMenuPrice(recipeId, null);
    } else if (!isNaN(value) && value >= 0) {
      onUpdateMenuPrice(recipeId, value);
    }
    setEditingPriceId(null);
    setPriceInputValue("");
  };

  const handleCancelEditPrice = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPriceId(null);
    setPriceInputValue("");
  };

  const handlePriceKeyDown = (recipeId: string, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!onUpdateMenuPrice) return;
      const value = parseFloat(priceInputValue);
      if (priceInputValue === "" || priceInputValue.trim() === "") {
        onUpdateMenuPrice(recipeId, null);
      } else if (!isNaN(value) && value >= 0) {
        onUpdateMenuPrice(recipeId, value);
      }
      setEditingPriceId(null);
      setPriceInputValue("");
    } else if (e.key === "Escape") {
      setEditingPriceId(null);
      setPriceInputValue("");
    }
  };

  const handleCategoryChange = (recipeId: string, category: RecipeCategory) => {
    if (!onUpdateCategory) return;
    onUpdateCategory(recipeId, category);
    setEditingCategoryId(null);
  };

  const handleOpenDuplicateDialog = (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    setDuplicateRecipe(recipe);
    setDuplicateName(`${recipe.name} (Copy)`);
    setDuplicateDialogOpen(true);
  };

  const handleDuplicate = () => {
    if (!onDuplicate || !duplicateRecipe || !duplicateName.trim()) return;
    onDuplicate(duplicateRecipe.id, duplicateName.trim());
    setDuplicateDialogOpen(false);
    setDuplicateRecipe(null);
    setDuplicateName("");
  };

  const handleStartEditName = (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNameId(recipe.id);
    setNameInputValue(recipe.name);
  };

  const handleSaveName = (recipeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateName) return;
    if (nameInputValue.trim() && nameInputValue !== recipes.find(r => r.id === recipeId)?.name) {
      onUpdateName(recipeId, nameInputValue.trim());
    }
    setEditingNameId(null);
    setNameInputValue("");
  };

  const handleCancelEditName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNameId(null);
    setNameInputValue("");
  };

  const handleNameKeyDown = (recipeId: string, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!onUpdateName) return;
      if (nameInputValue.trim() && nameInputValue !== recipes.find(r => r.id === recipeId)?.name) {
        onUpdateName(recipeId, nameInputValue.trim());
      }
      setEditingNameId(null);
      setNameInputValue("");
    } else if (e.key === "Escape") {
      setEditingNameId(null);
      setNameInputValue("");
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
              <TableHead
                className="text-right cursor-pointer font-semibold"
                onClick={() => handleSort("margin")}
              >
                Margin %
                {sortColumn === "margin" && (
                  <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </TableHead>
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
                    <TableCell className="font-medium" onClick={(e) => e.stopPropagation()} data-testid={`text-recipe-name-${recipe.id}`}>
                      {editingNameId === recipe.id ? (
                        <div className="flex items-center gap-1">
                          <ChefHat className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            type="text"
                            value={nameInputValue}
                            onChange={(e) => setNameInputValue(e.target.value)}
                            onKeyDown={(e) => handleNameKeyDown(recipe.id, e)}
                            className="h-7 px-2 text-sm flex-1"
                            placeholder="Recipe name"
                            autoFocus
                            disabled={isUpdatingName}
                            data-testid={`input-recipe-name-${recipe.id}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-green-600 flex-shrink-0"
                            onClick={(e) => handleSaveName(recipe.id, e)}
                            disabled={isUpdatingName}
                            data-testid={`button-save-name-${recipe.id}`}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive flex-shrink-0"
                            onClick={handleCancelEditName}
                            disabled={isUpdatingName}
                            data-testid={`button-cancel-name-${recipe.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center gap-2 group"
                          onClick={(e) => onUpdateName && handleStartEditName(recipe, e)}
                        >
                          <ChefHat className="h-4 w-4 text-muted-foreground" />
                          <span>{recipe.name}</span>
                          {recipe.isPackagingPreset && (
                            <Badge variant="outline" className="text-xs ml-1" data-testid={`badge-packaging-preset-${recipe.id}`}>
                              Packaging
                            </Badge>
                          )}
                          {recipe.isBaseRecipe && (
                            <Badge variant="outline" className="text-xs ml-1" data-testid={`badge-base-recipe-${recipe.id}`}>
                              Base Recipe
                            </Badge>
                          )}
                          {onUpdateName && (
                            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {editingCategoryId === recipe.id ? (
                        <Select
                          defaultValue={recipe.category}
                          onValueChange={(value) => handleCategoryChange(recipe.id, value as RecipeCategory)}
                          disabled={isUpdatingCategory}
                        >
                          <SelectTrigger 
                            className="h-7 w-[140px] text-xs"
                            data-testid={`select-category-${recipe.id}`}
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
                          onClick={() => onUpdateCategory && setEditingCategoryId(recipe.id)}
                        >
                          <Badge variant="outline" data-testid={`badge-category-${recipe.id}`}>
                            {recipeCategoryLabels[recipe.category as RecipeCategory] || recipe.category}
                          </Badge>
                          {onUpdateCategory && (
                            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      ${recipe.costPerServing.toFixed(2)}
                    </TableCell>
                    <TableCell 
                      className="text-right tabular-nums font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {editingPriceId === recipe.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <div className="relative w-24">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={priceInputValue}
                              onChange={(e) => setPriceInputValue(e.target.value)}
                              onKeyDown={(e) => handlePriceKeyDown(recipe.id, e)}
                              className="h-7 pl-6 pr-1 text-right text-sm"
                              placeholder="0.00"
                              autoFocus
                              data-testid={`input-menu-price-row-${recipe.id}`}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-green-600"
                            onClick={(e) => handleSavePrice(recipe.id, e)}
                            disabled={isUpdatingMenuPrice}
                            data-testid={`button-save-price-row-${recipe.id}`}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={handleCancelEditPrice}
                            disabled={isUpdatingMenuPrice}
                            data-testid={`button-cancel-price-row-${recipe.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-end gap-1 group"
                          onClick={(e) => onUpdateMenuPrice && handleStartEditPrice(recipe, e)}
                        >
                          {recipe.menuPrice ? (
                            <span data-testid={`text-menu-price-row-${recipe.id}`}>
                              ${recipe.menuPrice.toFixed(2)}
                            </span>
                          ) : (
                            <Badge variant="secondary" className="text-muted-foreground" data-testid={`badge-no-price-${recipe.id}`}>
                              Not set
                            </Badge>
                          )}
                          {onUpdateMenuPrice && (
                            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                          )}
                        </div>
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
                      <div className="flex items-center justify-end gap-1">
                        {onToggleBaseRecipe && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleBaseRecipe(recipe.id, recipe.isBaseRecipe);
                                }}
                                disabled={isTogglingBaseRecipe}
                                data-testid={`button-toggle-base-recipe-${recipe.id}`}
                              >
                                <ChefHat className={`h-4 w-4 ${recipe.isBaseRecipe ? "text-primary" : "text-muted-foreground"}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{recipe.isBaseRecipe ? "Unmark as base recipe" : "Mark as base recipe"}</TooltipContent>
                          </Tooltip>
                        )}
                        {onTogglePackagingPreset && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTogglePackagingPreset(recipe.id, recipe.isPackagingPreset);
                                }}
                                disabled={isTogglingPackagingPreset}
                                data-testid={`button-toggle-packaging-preset-${recipe.id}`}
                              >
                                <Package className={`h-4 w-4 ${recipe.isPackagingPreset ? "text-primary" : "text-muted-foreground"}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{recipe.isPackagingPreset ? "Unmark as packaging preset" : "Mark as packaging preset"}</TooltipContent>
                          </Tooltip>
                        )}
                        {onDuplicate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleOpenDuplicateDialog(recipe, e)}
                                data-testid={`button-duplicate-recipe-${recipe.id}`}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicate recipe</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDelete(recipe.id)}
                              data-testid={`button-delete-recipe-${recipe.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete recipe</TooltipContent>
                        </Tooltip>
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

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Recipe</DialogTitle>
            <DialogDescription>
              Create a copy of "{duplicateRecipe?.name}" with all its ingredients and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium" htmlFor="duplicate-name">
              New Recipe Name
            </label>
            <Input
              id="duplicate-name"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              placeholder="Enter new recipe name"
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && duplicateName.trim()) {
                  handleDuplicate();
                }
              }}
              data-testid="input-duplicate-name"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDuplicateDialogOpen(false)}
              data-testid="button-cancel-duplicate"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={!duplicateName.trim() || isDuplicating}
              data-testid="button-confirm-duplicate"
            >
              {isDuplicating ? "Duplicating..." : "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
