import { useState } from "react";
import { Plus, X, AlertCircle, AlertTriangle, Package, Search, ChefHat } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Ingredient, RecipeIngredient, Recipe, RecipeSubIngredient, MeasurementUnit } from "@shared/schema";
import { measurementUnits } from "@shared/schema";
import { calculateIngredientCost, checkDensityWarning } from "@/lib/unit-conversions";

interface RecipeBuilderProps {
  ingredients: Ingredient[];
  recipeIngredients: Array<RecipeIngredient & { ingredientDetails: Ingredient }>;
  onAddIngredient: (ingredientId: string, quantity: number, unit: string) => void;
  onRemoveIngredient: (recipeIngredientId: string) => void;
  onUpdateQuantity: (recipeIngredientId: string, quantity: number) => void;
  onUpdateUnit: (recipeIngredientId: string, unit: string) => void;
  allRecipes?: Recipe[];
  currentRecipeId?: string;
  subRecipes?: Array<RecipeSubIngredient & { subRecipeDetails: Recipe }>;
  onAddSubRecipe?: (subRecipeId: string, quantity: number) => void;
  onRemoveSubRecipe?: (subRecipeIngredientId: string) => void;
  onUpdateSubRecipeQuantity?: (subRecipeIngredientId: string, quantity: number) => void;
  onRemoveAllIngredients?: () => void;
  onRemoveAllPackaging?: () => void;
  onRemoveAllSubRecipes?: () => void;
}

const RecipeItemRow = ({
  ri,
  onUpdateQuantity,
  onUpdateUnit,
  onRemoveIngredient,
}: {
  ri: RecipeIngredient & { ingredientDetails: Ingredient };
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateUnit: (id: string, unit: string) => void;
  onRemoveIngredient: (id: string) => void;
}) => {
  const [localQuantity, setLocalQuantity] = useState(ri.quantity);
  const [localUnit, setLocalUnit] = useState(ri.unit);
  const [hasChanges, setHasChanges] = useState(false);

  const cost = calculateIngredientCost(
    ri.ingredientDetails,
    localQuantity,
    localUnit as any
  );
  
  const ingredientWarning = checkDensityWarning(
    ri.ingredientDetails,
    localUnit as MeasurementUnit
  );
  // Only show incompatible unit warnings - density is now optional
  const showIncompatibleWarning = ingredientWarning.needsWarning && ingredientWarning.warningType === "incompatible";

  const handleQuantityChange = (value: number) => {
    setLocalQuantity(value);
    setHasChanges(true);
  };

  const handleUnitChange = (value: string) => {
    setLocalUnit(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdateQuantity(ri.id, localQuantity);
    onUpdateUnit(ri.id, localUnit);
    setHasChanges(false);
  };

  return (
    <div
      key={ri.id}
      className="flex items-center justify-between p-3 border rounded-md hover-elevate"
      data-testid={`recipe-ingredient-${ri.id}`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{ri.ingredientDetails.name}</span>
          <Badge variant="secondary" className="text-xs">
            {ri.ingredientDetails.category}
          </Badge>
          {hasChanges && (
            <Badge variant="outline" className="text-xs">
              Unsaved
            </Badge>
          )}
          {showIncompatibleWarning && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="text-xs gap-1" data-testid={`badge-incompatible-warning-${ri.id}`}>
                  <AlertTriangle className="h-3 w-3" />
                  Incompatible units
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">{ingredientWarning.message}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Input
            type="number"
            step="0.01"
            value={localQuantity}
            onChange={(e) =>
              handleQuantityChange(parseFloat(e.target.value) || 0)
            }
            className="w-20 h-7 text-sm"
            data-testid={`input-quantity-${ri.id}`}
          />
          <Select value={localUnit} onValueChange={handleUnitChange}>
            <SelectTrigger className="w-28 h-7 text-sm" data-testid={`select-unit-${ri.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {measurementUnits.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium tabular-nums" data-testid={`text-ingredient-cost-${ri.id}`}>
          ${cost.toFixed(2)}
        </span>
        {hasChanges && (
          <Button
            size="sm"
            onClick={handleSave}
            data-testid={`button-save-ingredient-${ri.id}`}
          >
            Save
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemoveIngredient(ri.id)}
          data-testid={`button-remove-ingredient-${ri.id}`}
        >
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

const SubRecipeItemRow = ({
  subRecipe,
  onUpdateQuantity,
  onRemove,
}: {
  subRecipe: RecipeSubIngredient & { subRecipeDetails: Recipe };
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}) => {
  const [localQuantity, setLocalQuantity] = useState(subRecipe.quantity);
  const [hasChanges, setHasChanges] = useState(false);

  const cost = subRecipe.subRecipeDetails.costPerServing * localQuantity;

  const handleQuantityChange = (value: number) => {
    setLocalQuantity(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdateQuantity(subRecipe.id, localQuantity);
    setHasChanges(false);
  };

  return (
    <div
      key={subRecipe.id}
      className="flex items-center justify-between p-3 border rounded-md hover-elevate"
      data-testid={`sub-recipe-ingredient-${subRecipe.id}`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{subRecipe.subRecipeDetails.name}</span>
          {subRecipe.subRecipeDetails.category && (
            <Badge variant="secondary" className="text-xs">
              {subRecipe.subRecipeDetails.category}
            </Badge>
          )}
          {hasChanges && (
            <Badge variant="outline" className="text-xs">
              Unsaved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Input
            type="number"
            step="0.01"
            value={localQuantity}
            onChange={(e) =>
              handleQuantityChange(parseFloat(e.target.value) || 0)
            }
            className="w-20 h-7 text-sm"
            data-testid={`input-sub-recipe-quantity-${subRecipe.id}`}
          />
          <span className="text-sm text-muted-foreground">
            servings × ${subRecipe.subRecipeDetails.costPerServing.toFixed(2)}/serving
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium tabular-nums" data-testid={`text-sub-recipe-cost-${subRecipe.id}`}>
          ${cost.toFixed(2)}
        </span>
        {hasChanges && (
          <Button
            size="sm"
            onClick={handleSave}
            data-testid={`button-save-sub-recipe-${subRecipe.id}`}
          >
            Save
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(subRecipe.id)}
          data-testid={`button-remove-sub-recipe-${subRecipe.id}`}
        >
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

export function RecipeBuilder({
  ingredients,
  recipeIngredients,
  onAddIngredient,
  onRemoveIngredient,
  onUpdateQuantity,
  onUpdateUnit,
  allRecipes = [],
  currentRecipeId,
  subRecipes = [],
  onAddSubRecipe,
  onRemoveSubRecipe,
  onUpdateSubRecipeQuantity,
  onRemoveAllIngredients,
  onRemoveAllPackaging,
  onRemoveAllSubRecipes,
}: RecipeBuilderProps) {
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("units");
  const [ingredientSearch, setIngredientSearch] = useState("");
  
  const [selectedPackagingId, setSelectedPackagingId] = useState("");
  const [packagingQuantity, setPackagingQuantity] = useState(1);
  const [packagingUnit, setPackagingUnit] = useState("units");
  const [packagingSearch, setPackagingSearch] = useState("");

  const [selectedSubRecipeId, setSelectedSubRecipeId] = useState("");
  const [subRecipeQuantity, setSubRecipeQuantity] = useState(1);
  const [subRecipeSearch, setSubRecipeSearch] = useState("");

  const [confirmRemoveAllIngredients, setConfirmRemoveAllIngredients] = useState(false);
  const [confirmRemoveAllPackaging, setConfirmRemoveAllPackaging] = useState(false);
  const [confirmRemoveAllSubRecipes, setConfirmRemoveAllSubRecipes] = useState(false);

  const usedIngredientIds = recipeIngredients.map((ri) => ri.ingredientId);
  
  // Split ingredients into regular ingredients and packaging
  const regularIngredients = ingredients.filter((ing) => !ing.isPackaging);
  const packagingItems = ingredients.filter((ing) => ing.isPackaging);
  
  // First filter out already-used ingredients (before search)
  const unusedIngredients = regularIngredients.filter(
    (ing) => !usedIngredientIds.includes(ing.id)
  );
  const unusedPackaging = packagingItems.filter(
    (ing) => !usedIngredientIds.includes(ing.id)
  );

  // Then apply search filter with partial word matching on both name and category
  const availableIngredients = unusedIngredients.filter((ing) => {
    if (!ingredientSearch.trim()) return true;
    const searchLower = ingredientSearch.toLowerCase();
    // Match any part of any word in name or category
    const nameWords = ing.name.toLowerCase().split(/\s+/);
    const categoryWords = ing.category.toLowerCase().split(/\s+/);
    return nameWords.some(word => word.includes(searchLower)) ||
           categoryWords.some(word => word.includes(searchLower)) ||
           ing.name.toLowerCase().includes(searchLower) ||
           ing.category.toLowerCase().includes(searchLower);
  });
  
  const availablePackaging = unusedPackaging.filter((ing) => {
    if (!packagingSearch.trim()) return true;
    const searchLower = packagingSearch.toLowerCase();
    const nameWords = ing.name.toLowerCase().split(/\s+/);
    const categoryWords = ing.category.toLowerCase().split(/\s+/);
    return nameWords.some(word => word.includes(searchLower)) ||
           categoryWords.some(word => word.includes(searchLower)) ||
           ing.name.toLowerCase().includes(searchLower) ||
           ing.category.toLowerCase().includes(searchLower);
  });

  const handleAdd = () => {
    if (selectedIngredientId && quantity > 0) {
      onAddIngredient(selectedIngredientId, quantity, unit);
      setSelectedIngredientId("");
      setQuantity(1);
      setUnit("units");
    }
  };

  const handleAddPackaging = () => {
    if (selectedPackagingId && packagingQuantity > 0) {
      onAddIngredient(selectedPackagingId, packagingQuantity, packagingUnit);
      setSelectedPackagingId("");
      setPackagingQuantity(1);
      setPackagingUnit("units");
    }
  };

  const handleAddSubRecipe = () => {
    if (selectedSubRecipeId && subRecipeQuantity > 0 && onAddSubRecipe) {
      onAddSubRecipe(selectedSubRecipeId, subRecipeQuantity);
      setSelectedSubRecipeId("");
      setSubRecipeQuantity(1);
    }
  };

  const usedSubRecipeIds = subRecipes.map((sr) => sr.subRecipeId);
  
  const unusedSubRecipes = allRecipes.filter(
    (r) => r.id !== currentRecipeId && !usedSubRecipeIds.includes(r.id)
  );

  const availableSubRecipes = unusedSubRecipes.filter((r) => {
    if (!subRecipeSearch.trim()) return true;
    const searchLower = subRecipeSearch.toLowerCase();
    return r.name.toLowerCase().includes(searchLower) ||
           (r.category && r.category.toLowerCase().includes(searchLower));
  });

  // Separate recipe ingredients into ingredients and packaging
  const recipeRegularIngredients = recipeIngredients.filter(
    (ri) => !ri.ingredientDetails.isPackaging
  );
  const recipePackagingItems = recipeIngredients.filter(
    (ri) => ri.ingredientDetails.isPackaging
  );

  const calculateCost = (items: typeof recipeIngredients) => {
    return items.reduce((sum, ri) => {
      const cost = calculateIngredientCost(
        ri.ingredientDetails,
        ri.quantity,
        ri.unit as any
      );
      return sum + cost;
    }, 0);
  };

  const ingredientsCost = calculateCost(recipeRegularIngredients);
  const packagingCost = calculateCost(recipePackagingItems);
  const subRecipesCost = subRecipes.reduce((sum, sr) => {
    return sum + (sr.subRecipeDetails.costPerServing * sr.quantity);
  }, 0);
  const totalCost = ingredientsCost + packagingCost + subRecipesCost;

  // Check if selected ingredient + unit combination needs density warning
  const selectedIngredient = selectedIngredientId
    ? ingredients.find((ing) => ing.id === selectedIngredientId)
    : null;
  const densityWarning = checkDensityWarning(
    selectedIngredient || null,
    unit as MeasurementUnit
  );
  
  // Check if selected packaging + unit combination needs density warning
  const selectedPackaging = selectedPackagingId
    ? ingredients.find((ing) => ing.id === selectedPackagingId)
    : null;
  const packagingDensityWarning = checkDensityWarning(
    selectedPackaging || null,
    packagingUnit as MeasurementUnit
  );


  return (
    <div className="space-y-6">
      {/* Ingredients Section */}
      <Card>
        <CardHeader>
          <CardTitle>Add Ingredients</CardTitle>
          <CardDescription>Select ingredients and specify quantities for this recipe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unusedIngredients.length === 0 && recipeRegularIngredients.length > 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                All available ingredients have been added to this recipe.
              </AlertDescription>
            </Alert>
          ) : unusedIngredients.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No ingredients available. Please add ingredients to your database first.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search ingredients..."
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-recipe-ingredients"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Select 
                  key={`ingredient-${availableIngredients.length}-${ingredientSearch}`}
                  value={selectedIngredientId} 
                  onValueChange={setSelectedIngredientId}
                >
                  <SelectTrigger className="md:col-span-2" data-testid="select-ingredient">
                    <SelectValue placeholder="Select ingredient" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableIngredients.length > 0 ? (
                      availableIngredients.map((ing) => (
                        <SelectItem key={ing.id} value={ing.id}>
                          {ing.name} ({ing.category})
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No ingredients match "{ingredientSearch}"
                      </div>
                    )}
                  </SelectContent>
                </Select>

              <Input
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                placeholder="Quantity"
                data-testid="input-ingredient-quantity"
              />

              <div className="flex gap-2">
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger data-testid="select-ingredient-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {measurementUnits.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleAdd}
                  disabled={!selectedIngredientId || quantity <= 0}
                  data-testid="button-add-ingredient-to-recipe"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          )}

          {densityWarning.needsWarning && selectedIngredient && (
            <Alert variant={densityWarning.warningType === "incompatible" ? "destructive" : "default"} data-testid="alert-density-warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> {densityWarning.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Packaging Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Add Packaging</CardTitle>
          </div>
          <CardDescription>Select packaging items like cups, lids, and sleeves</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unusedPackaging.length === 0 && recipePackagingItems.length > 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                All available packaging items have been added to this recipe.
              </AlertDescription>
            </Alert>
          ) : unusedPackaging.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No packaging items available. Please add packaging items (cups, lids, sleeves) to your ingredients database first and mark them as packaging.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search packaging..."
                  value={packagingSearch}
                  onChange={(e) => setPackagingSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-recipe-packaging"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Select 
                  key={`packaging-${availablePackaging.length}-${packagingSearch}`}
                  value={selectedPackagingId} 
                  onValueChange={setSelectedPackagingId}
                >
                  <SelectTrigger className="md:col-span-2" data-testid="select-packaging">
                    <SelectValue placeholder="Select packaging" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePackaging.length > 0 ? (
                      availablePackaging.map((ing) => (
                        <SelectItem key={ing.id} value={ing.id}>
                          {ing.name} ({ing.category})
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No packaging matches "{packagingSearch}"
                      </div>
                    )}
                </SelectContent>
              </Select>

              <Input
                type="number"
                step="0.01"
                value={packagingQuantity}
                onChange={(e) => setPackagingQuantity(parseFloat(e.target.value) || 0)}
                placeholder="Quantity"
                data-testid="input-packaging-quantity"
              />

              <div className="flex gap-2">
                <Select value={packagingUnit} onValueChange={setPackagingUnit}>
                  <SelectTrigger data-testid="select-packaging-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {measurementUnits.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleAddPackaging}
                  disabled={!selectedPackagingId || packagingQuantity <= 0}
                  data-testid="button-add-packaging-to-recipe"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          )}

          {packagingDensityWarning.needsWarning && selectedPackaging && (
            <Alert variant={packagingDensityWarning.warningType === "incompatible" ? "destructive" : "default"} data-testid="alert-packaging-density-warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> {packagingDensityWarning.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Add Recipe as Ingredient Section */}
      {onAddSubRecipe && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Add Recipe as Ingredient</CardTitle>
            </div>
            <CardDescription>Use other recipes as ingredients (e.g., sauces, bases, pre-made components)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {unusedSubRecipes.length === 0 && subRecipes.length > 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  All available recipes have been added as ingredients.
                </AlertDescription>
              </Alert>
            ) : unusedSubRecipes.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No other recipes available. Create more recipes to use them as ingredients.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search recipes..."
                    value={subRecipeSearch}
                    onChange={(e) => setSubRecipeSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-sub-recipes"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Select 
                    key={`sub-recipe-${availableSubRecipes.length}-${subRecipeSearch}`}
                    value={selectedSubRecipeId} 
                    onValueChange={setSelectedSubRecipeId}
                  >
                    <SelectTrigger className="md:col-span-2" data-testid="select-sub-recipe">
                      <SelectValue placeholder="Select recipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSubRecipes.length > 0 ? (
                        availableSubRecipes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} {r.category && `(${r.category})`}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          No recipes match "{subRecipeSearch}"
                        </div>
                      )}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    step="0.01"
                    value={subRecipeQuantity}
                    onChange={(e) => setSubRecipeQuantity(parseFloat(e.target.value) || 0)}
                    placeholder="Servings"
                    data-testid="input-sub-recipe-quantity"
                  />

                  <Button
                    onClick={handleAddSubRecipe}
                    disabled={!selectedSubRecipeId || subRecipeQuantity <= 0}
                    data-testid="button-add-sub-recipe"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
                {selectedSubRecipeId && (
                  <div className="text-sm text-muted-foreground">
                    {(() => {
                      const selectedRecipe = allRecipes.find(r => r.id === selectedSubRecipeId);
                      if (selectedRecipe) {
                        const estimatedCost = selectedRecipe.costPerServing * subRecipeQuantity;
                        return (
                          <span>
                            Cost per serving: ${selectedRecipe.costPerServing.toFixed(2)} × {subRecipeQuantity} servings = ${estimatedCost.toFixed(2)}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recipe Ingredients List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <div>
            <CardTitle>Recipe Ingredients</CardTitle>
            <CardDescription>Food ingredients in this recipe</CardDescription>
          </div>
          {recipeRegularIngredients.length > 0 && onRemoveAllIngredients && !confirmRemoveAllIngredients && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemoveAllIngredients(true)}
              data-testid="button-remove-all-ingredients"
              className="text-destructive hover:text-destructive"
            >
              Remove All
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {confirmRemoveAllIngredients && onRemoveAllIngredients && (
            <div className="flex items-center gap-2 p-3 border rounded-md bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium flex-1">Remove all ingredients?</span>
              <Button
                size="icon"
                className="h-8 w-8 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  onRemoveAllIngredients();
                  setConfirmRemoveAllIngredients(false);
                }}
                data-testid="button-confirm-remove-all-ingredients"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                className="h-8 w-8 text-destructive"
                variant="ghost"
                onClick={() => setConfirmRemoveAllIngredients(false)}
                data-testid="button-cancel-remove-all-ingredients"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {recipeRegularIngredients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No ingredients added yet. Add ingredients from the selection above.
            </p>
          ) : (
            <>
              {recipeRegularIngredients.map((ri) => (
                <RecipeItemRow
                  key={ri.id}
                  ri={ri}
                  onUpdateQuantity={onUpdateQuantity}
                  onUpdateUnit={onUpdateUnit}
                  onRemoveIngredient={onRemoveIngredient}
                />
              ))}

              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Ingredients Subtotal</span>
                  <span className="text-lg font-bold tabular-nums" data-testid="text-ingredients-subtotal">
                    ${ingredientsCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recipe Packaging List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Packaging Items</CardTitle>
            </div>
            <CardDescription>Cups, lids, sleeves, and other packaging</CardDescription>
          </div>
          {recipePackagingItems.length > 0 && onRemoveAllPackaging && !confirmRemoveAllPackaging && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemoveAllPackaging(true)}
              data-testid="button-remove-all-packaging"
              className="text-destructive hover:text-destructive"
            >
              Remove All
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {confirmRemoveAllPackaging && onRemoveAllPackaging && (
            <div className="flex items-center gap-2 p-3 border rounded-md bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium flex-1">Remove all packaging items?</span>
              <Button
                size="icon"
                className="h-8 w-8 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  onRemoveAllPackaging();
                  setConfirmRemoveAllPackaging(false);
                }}
                data-testid="button-confirm-remove-all-packaging"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                className="h-8 w-8 text-destructive"
                variant="ghost"
                onClick={() => setConfirmRemoveAllPackaging(false)}
                data-testid="button-cancel-remove-all-packaging"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {recipePackagingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No packaging items added yet. Add packaging from the selection above.
            </p>
          ) : (
            <>
              {recipePackagingItems.map((ri) => (
                <RecipeItemRow
                  key={ri.id}
                  ri={ri}
                  onUpdateQuantity={onUpdateQuantity}
                  onUpdateUnit={onUpdateUnit}
                  onRemoveIngredient={onRemoveIngredient}
                />
              ))}

              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Packaging Subtotal</span>
                  <span className="text-lg font-bold tabular-nums" data-testid="text-packaging-subtotal">
                    ${packagingCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sub-Recipe Ingredients List */}
      {onRemoveSubRecipe && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Recipe Ingredients</CardTitle>
              </div>
              <CardDescription>Other recipes used as components</CardDescription>
            </div>
            {subRecipes.length > 0 && onRemoveAllSubRecipes && !confirmRemoveAllSubRecipes && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmRemoveAllSubRecipes(true)}
                data-testid="button-remove-all-sub-recipes"
                className="text-destructive hover:text-destructive"
              >
                Remove All
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {confirmRemoveAllSubRecipes && onRemoveAllSubRecipes && (
              <div className="flex items-center gap-2 p-3 border rounded-md bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium flex-1">Remove all recipe ingredients?</span>
                <Button
                  size="icon"
                  className="h-8 w-8 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    onRemoveAllSubRecipes();
                    setConfirmRemoveAllSubRecipes(false);
                  }}
                  data-testid="button-confirm-remove-all-sub-recipes"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  variant="ghost"
                  onClick={() => setConfirmRemoveAllSubRecipes(false)}
                  data-testid="button-cancel-remove-all-sub-recipes"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {subRecipes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recipes added as ingredients yet. Add recipes from the selection above.
              </p>
            ) : (
              <>
                {subRecipes.map((sr) => (
                  <SubRecipeItemRow
                    key={sr.id}
                    subRecipe={sr}
                    onUpdateQuantity={onUpdateSubRecipeQuantity!}
                    onRemove={onRemoveSubRecipe}
                  />
                ))}

                <div className="border-t pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Recipe Ingredients Subtotal</span>
                    <span className="text-lg font-bold tabular-nums" data-testid="text-sub-recipes-subtotal">
                      ${subRecipesCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grand Total */}
      {(recipeRegularIngredients.length > 0 || recipePackagingItems.length > 0 || subRecipes.length > 0) && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xl font-semibold">Total Recipe Cost</span>
              <span className="text-3xl font-bold tabular-nums text-primary" data-testid="text-total-cost">
                ${totalCost.toFixed(2)}
              </span>
            </div>
            {(recipeRegularIngredients.length > 0 || recipePackagingItems.length > 0 || subRecipes.length > 0) && 
             (recipeRegularIngredients.length + recipePackagingItems.length + subRecipes.length) > 1 && (
              <div className="mt-3 pt-3 border-t text-sm text-muted-foreground space-y-1">
                {recipeRegularIngredients.length > 0 && (
                  <div className="flex justify-between">
                    <span>Ingredients:</span>
                    <span className="tabular-nums">${ingredientsCost.toFixed(2)}</span>
                  </div>
                )}
                {recipePackagingItems.length > 0 && (
                  <div className="flex justify-between">
                    <span>Packaging:</span>
                    <span className="tabular-nums">${packagingCost.toFixed(2)}</span>
                  </div>
                )}
                {subRecipes.length > 0 && (
                  <div className="flex justify-between">
                    <span>Recipe Ingredients:</span>
                    <span className="tabular-nums">${subRecipesCost.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
