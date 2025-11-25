import { useState } from "react";
import { Plus, X, AlertCircle, AlertTriangle, Package, Search } from "lucide-react";
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
import type { Ingredient, RecipeIngredient, MeasurementUnit } from "@shared/schema";
import { measurementUnits } from "@shared/schema";
import { calculateIngredientCost, checkDensityWarning } from "@/lib/unit-conversions";

interface RecipeBuilderProps {
  ingredients: Ingredient[];
  recipeIngredients: Array<RecipeIngredient & { ingredientDetails: Ingredient }>;
  onAddIngredient: (ingredientId: string, quantity: number, unit: string) => void;
  onRemoveIngredient: (recipeIngredientId: string) => void;
  onUpdateQuantity: (recipeIngredientId: string, quantity: number) => void;
  onUpdateUnit: (recipeIngredientId: string, unit: string) => void;
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
  const cost = calculateIngredientCost(
    ri.ingredientDetails,
    ri.quantity,
    ri.unit as any
  );
  
  const ingredientWarning = checkDensityWarning(
    ri.ingredientDetails,
    ri.unit as MeasurementUnit
  );
  // Only show incompatible unit warnings - density is now optional
  const showIncompatibleWarning = ingredientWarning.needsWarning && ingredientWarning.warningType === "incompatible";

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
            value={ri.quantity}
            onChange={(e) =>
              onUpdateQuantity(ri.id, parseFloat(e.target.value) || 0)
            }
            className="w-20 h-7 text-sm"
            data-testid={`input-quantity-${ri.id}`}
          />
          <Select value={ri.unit} onValueChange={(value) => onUpdateUnit(ri.id, value)}>
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

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium tabular-nums" data-testid={`text-ingredient-cost-${ri.id}`}>
          ${cost.toFixed(2)}
        </span>
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

export function RecipeBuilder({
  ingredients,
  recipeIngredients,
  onAddIngredient,
  onRemoveIngredient,
  onUpdateQuantity,
  onUpdateUnit,
}: RecipeBuilderProps) {
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("units");
  const [ingredientSearch, setIngredientSearch] = useState("");
  
  const [selectedPackagingId, setSelectedPackagingId] = useState("");
  const [packagingQuantity, setPackagingQuantity] = useState(1);
  const [packagingUnit, setPackagingUnit] = useState("units");
  const [packagingSearch, setPackagingSearch] = useState("");

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
  const totalCost = ingredientsCost + packagingCost;

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

      {/* Recipe Ingredients List */}
      <Card>
        <CardHeader>
          <CardTitle>Recipe Ingredients</CardTitle>
          <CardDescription>Food ingredients in this recipe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Packaging Items</CardTitle>
          </div>
          <CardDescription>Cups, lids, sleeves, and other packaging</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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

      {/* Grand Total */}
      {(recipeRegularIngredients.length > 0 || recipePackagingItems.length > 0) && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xl font-semibold">Total Recipe Cost</span>
              <span className="text-3xl font-bold tabular-nums text-primary" data-testid="text-total-cost">
                ${totalCost.toFixed(2)}
              </span>
            </div>
            {recipeRegularIngredients.length > 0 && recipePackagingItems.length > 0 && (
              <div className="mt-3 pt-3 border-t text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Ingredients:</span>
                  <span className="tabular-nums">${ingredientsCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Packaging:</span>
                  <span className="tabular-nums">${packagingCost.toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
