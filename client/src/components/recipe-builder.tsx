import { useState } from "react";
import { Plus, X, AlertCircle, AlertTriangle } from "lucide-react";
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
import { calculateIngredientCost, checkDensityWarning } from "@/lib/unit-conversions";

interface RecipeBuilderProps {
  ingredients: Ingredient[];
  recipeIngredients: Array<RecipeIngredient & { ingredientDetails: Ingredient }>;
  onAddIngredient: (ingredientId: string, quantity: number, unit: string) => void;
  onRemoveIngredient: (recipeIngredientId: string) => void;
  onUpdateQuantity: (recipeIngredientId: string, quantity: number) => void;
}

export function RecipeBuilder({
  ingredients,
  recipeIngredients,
  onAddIngredient,
  onRemoveIngredient,
  onUpdateQuantity,
}: RecipeBuilderProps) {
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("units");

  const usedIngredientIds = recipeIngredients.map((ri) => ri.ingredientId);
  const availableIngredients = ingredients.filter(
    (ing) => !usedIngredientIds.includes(ing.id)
  );

  const handleAdd = () => {
    if (selectedIngredientId && quantity > 0) {
      onAddIngredient(selectedIngredientId, quantity, unit);
      setSelectedIngredientId("");
      setQuantity(1);
      setUnit("units");
    }
  };

  const calculateTotalCost = () => {
    return recipeIngredients.reduce((sum, ri) => {
      const cost = calculateIngredientCost(
        ri.ingredientDetails,
        ri.quantity,
        ri.unit as any
      );
      return sum + cost;
    }, 0);
  };

  const totalCost = calculateTotalCost();

  // Check if selected ingredient + unit combination needs density warning
  const selectedIngredient = selectedIngredientId
    ? ingredients.find((ing) => ing.id === selectedIngredientId)
    : null;
  const densityWarning = checkDensityWarning(
    selectedIngredient || null,
    unit as MeasurementUnit
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Ingredients</CardTitle>
          <CardDescription>Select ingredients and specify quantities for this recipe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableIngredients.length === 0 && recipeIngredients.length > 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                All available ingredients have been added to this recipe.
              </AlertDescription>
            </Alert>
          ) : availableIngredients.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No ingredients available. Please add ingredients to your database first.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select value={selectedIngredientId} onValueChange={setSelectedIngredientId}>
                <SelectTrigger className="md:col-span-2" data-testid="select-ingredient">
                  <SelectValue placeholder="Select ingredient" />
                </SelectTrigger>
                <SelectContent>
                  {availableIngredients.map((ing) => (
                    <SelectItem key={ing.id} value={ing.id}>
                      {ing.name} ({ing.category})
                    </SelectItem>
                  ))}
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
                    {(["cups", "ounces", "grams", "units", "teaspoons", "tablespoons", "pounds", "kilograms", "milliliters", "liters", "pints", "quarts", "gallons"] as const).map(
                      (u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      )
                    )}
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
          )}

          {/* Density Warning Alert */}
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

      <Card>
        <CardHeader>
          <CardTitle>Recipe Ingredients</CardTitle>
          <CardDescription>Current ingredients in this recipe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recipeIngredients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No ingredients added yet. Add ingredients from the selection above.
            </p>
          ) : (
            <>
              {recipeIngredients.map((ri) => {
                const cost = calculateIngredientCost(
                  ri.ingredientDetails,
                  ri.quantity,
                  ri.unit as any
                );
                
                // Check if this ingredient needs density warning
                const ingredientWarning = checkDensityWarning(
                  ri.ingredientDetails,
                  ri.unit as MeasurementUnit
                );
                const showCostWarning = cost === 0 && ingredientWarning.needsWarning;

                return (
                  <div
                    key={ri.id}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/30"
                    data-testid={`recipe-ingredient-${ri.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{ri.ingredientDetails.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {ri.ingredientDetails.category}
                        </Badge>
                        {showCostWarning && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="destructive" className="text-xs gap-1" data-testid={`badge-density-warning-${ri.id}`}>
                                <AlertTriangle className="h-3 w-3" />
                                Needs density
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-sm">{ingredientWarning.message}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={ri.quantity}
                          onChange={(e) =>
                            onUpdateQuantity(ri.id, parseFloat(e.target.value) || 0)
                          }
                          className="inline-block w-20 h-7 text-sm mr-2"
                          data-testid={`input-quantity-${ri.id}`}
                        />
                        {ri.unit}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {showCostWarning ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm font-medium tabular-nums text-destructive flex items-center gap-1" data-testid={`text-cost-warning-${ri.id}`}>
                              <AlertTriangle className="h-3 w-3" />
                              ${cost.toFixed(2)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm">Cost may be inaccurate - density required</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-sm font-medium tabular-nums">
                          ${cost.toFixed(2)}
                        </span>
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
              })}

              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Total Recipe Cost</span>
                  <span className="text-2xl font-bold tabular-nums text-destructive" data-testid="text-total-cost">
                    ${totalCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
