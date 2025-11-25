import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRecipeSchema, type InsertRecipe, type Ingredient, recipeCategories, measurementUnits } from "@shared/schema";
import { Plus, X, Search, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateIngredientCost, checkDensityWarning } from "@/lib/unit-conversions";

interface RecipeIngredientRow {
  tempId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
}

interface AddRecipeWithIngredientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertRecipe, ingredients: RecipeIngredientRow[]) => void;
  ingredients: Ingredient[];
  isLoading?: boolean;
}

export function AddRecipeWithIngredientsDialog({
  open,
  onOpenChange,
  onSubmit,
  ingredients,
  isLoading,
}: AddRecipeWithIngredientsDialogProps) {
  const form = useForm<InsertRecipe>({
    resolver: zodResolver(insertRecipeSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "other",
      servings: 1,
      menuPrice: undefined,
    },
  });

  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientRow[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("units");

  // Get available ingredients (not already added)
  const usedIngredientIds = recipeIngredients.map((ri) => ri.ingredientId);
  const regularIngredients = ingredients.filter((ing) => !ing.isPackaging);
  const packagingItems = ingredients.filter((ing) => ing.isPackaging);

  const unusedIngredients = regularIngredients.filter((ing) => !usedIngredientIds.includes(ing.id));
  const unusedPackaging = packagingItems.filter((ing) => !usedIngredientIds.includes(ing.id));

  // Filter by search
  const availableIngredients = useMemo(() => {
    if (!ingredientSearch.trim()) return unusedIngredients;
    const searchLower = ingredientSearch.toLowerCase();
    return unusedIngredients.filter((ing) => {
      const nameWords = ing.name.toLowerCase().split(/\s+/);
      const categoryWords = ing.category.toLowerCase().split(/\s+/);
      return (
        nameWords.some((word) => word.includes(searchLower)) ||
        categoryWords.some((word) => word.includes(searchLower)) ||
        ing.name.toLowerCase().includes(searchLower) ||
        ing.category.toLowerCase().includes(searchLower)
      );
    });
  }, [ingredientSearch, unusedIngredients]);

  const availablePackaging = useMemo(() => {
    if (!ingredientSearch.trim()) return unusedPackaging;
    const searchLower = ingredientSearch.toLowerCase();
    return unusedPackaging.filter((ing) => {
      const nameWords = ing.name.toLowerCase().split(/\s+/);
      const categoryWords = ing.category.toLowerCase().split(/\s+/);
      return (
        nameWords.some((word) => word.includes(searchLower)) ||
        categoryWords.some((word) => word.includes(searchLower)) ||
        ing.name.toLowerCase().includes(searchLower) ||
        ing.category.toLowerCase().includes(searchLower)
      );
    });
  }, [ingredientSearch, unusedPackaging]);

  const handleAddIngredient = () => {
    if (selectedIngredientId && quantity > 0) {
      setRecipeIngredients([
        ...recipeIngredients,
        {
          tempId: Math.random().toString(),
          ingredientId: selectedIngredientId,
          quantity,
          unit,
        },
      ]);
      setSelectedIngredientId("");
      setQuantity(1);
      setUnit("units");
      setIngredientSearch("");
    }
  };

  const handleRemoveIngredient = (tempId: string) => {
    setRecipeIngredients(recipeIngredients.filter((ri) => ri.tempId !== tempId));
  };

  const handleUpdateQuantity = (tempId: string, newQuantity: number) => {
    setRecipeIngredients(
      recipeIngredients.map((ri) =>
        ri.tempId === tempId ? { ...ri, quantity: newQuantity } : ri
      )
    );
  };

  const handleUpdateUnit = (tempId: string, newUnit: string) => {
    setRecipeIngredients(
      recipeIngredients.map((ri) =>
        ri.tempId === tempId ? { ...ri, unit: newUnit } : ri
      )
    );
  };

  const handleSubmit = (data: InsertRecipe) => {
    onSubmit(data, recipeIngredients);
    form.reset();
    setRecipeIngredients([]);
    setIngredientSearch("");
  };

  const calculateTotalCost = () => {
    return recipeIngredients.reduce((sum, ri) => {
      const ing = ingredients.find((i) => i.id === ri.ingredientId);
      if (!ing) return sum;
      const cost = calculateIngredientCost(ing, ri.quantity, ri.unit as any);
      return sum + cost;
    }, 0);
  };

  const selectedIngredient = selectedIngredientId
    ? ingredients.find((ing) => ing.id === selectedIngredientId)
    : null;

  const densityWarning = selectedIngredient
    ? checkDensityWarning(selectedIngredient, unit as any)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Recipe</DialogTitle>
          <DialogDescription>
            Enter recipe details and add ingredients all in one place
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Recipe Details Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recipe Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipe Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Caramel Latte"
                          {...field}
                          data-testid="input-recipe-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Rich espresso with steamed milk and caramel"
                          {...field}
                          value={field.value || ""}
                          data-testid="textarea-recipe-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-recipe-category">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {recipeCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="servings"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Servings</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            data-testid="input-servings"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="menuPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Menu Price (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                            }
                            data-testid="input-menu-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Ingredients Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Ingredients</CardTitle>
                <CardDescription>Search and add ingredients to your recipe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Add Row */}
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search ingredients or packaging..."
                      value={ingredientSearch}
                      onChange={(e) => setIngredientSearch(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-recipe-ingredients"
                    />
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <Select
                      value={selectedIngredientId}
                      onValueChange={setSelectedIngredientId}
                    >
                      <SelectTrigger className="col-span-5" data-testid="select-ingredient">
                        <SelectValue placeholder="Select ingredient..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableIngredients.length > 0 || availablePackaging.length > 0 ? (
                          <>
                            {availableIngredients.length > 0 && (
                              <>
                                {availableIngredients.map((ing) => (
                                  <SelectItem key={ing.id} value={ing.id}>
                                    {ing.name} ({ing.category})
                                  </SelectItem>
                                ))}
                              </>
                            )}
                            {availablePackaging.length > 0 && (
                              <>
                                {availablePackaging.map((ing) => (
                                  <SelectItem key={ing.id} value={ing.id}>
                                    📦 {ing.name}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </>
                        ) : (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            {ingredientSearch
                              ? `No ingredients match "${ingredientSearch}"`
                              : "No ingredients available"}
                          </div>
                        )}
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      step="0.01"
                      value={quantity}
                      onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                      placeholder="Qty"
                      className="col-span-2"
                      data-testid="input-ingredient-quantity"
                    />

                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger className="col-span-3" data-testid="select-ingredient-unit">
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
                      type="button"
                      size="icon"
                      onClick={handleAddIngredient}
                      disabled={!selectedIngredientId || quantity <= 0}
                      data-testid="button-add-ingredient"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {densityWarning && densityWarning.needsWarning && (
                    <Alert className="border-yellow-600 bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{densityWarning.message}</AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Added Ingredients Table */}
                {recipeIngredients.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Added Ingredients ({recipeIngredients.length})</h4>
                    <div className="border rounded-lg overflow-hidden">
                      {recipeIngredients.map((ri) => {
                        const ing = ingredients.find((i) => i.id === ri.ingredientId);
                        if (!ing) return null;
                        const cost = calculateIngredientCost(ing, ri.quantity, ri.unit as any);
                        const ingredientWarning = checkDensityWarning(ing, ri.unit as any);
                        const showCostWarning = cost === 0 && ingredientWarning.needsWarning;

                        return (
                          <div
                            key={ri.tempId}
                            className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50"
                            data-testid={`recipe-ingredient-row-${ri.tempId}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{ing.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {ing.category}
                                </Badge>
                                {showCostWarning && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="destructive" className="text-xs gap-1">
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
                              <div className="flex items-center gap-2 mt-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={ri.quantity}
                                  onChange={(e) =>
                                    handleUpdateQuantity(ri.tempId, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-20 h-7 text-sm"
                                  data-testid={`input-quantity-${ri.tempId}`}
                                />
                                <Select
                                  value={ri.unit}
                                  onValueChange={(val) => handleUpdateUnit(ri.tempId, val)}
                                >
                                  <SelectTrigger className="w-28 h-7 text-sm" data-testid={`select-unit-${ri.tempId}`}>
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
                              {showCostWarning ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-sm font-medium tabular-nums text-destructive flex items-center gap-1">
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
                                onClick={() => handleRemoveIngredient(ri.tempId)}
                                data-testid={`button-remove-ingredient-${ri.tempId}`}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center pt-2 px-1">
                      <span className="text-sm font-medium">Total Ingredient Cost:</span>
                      <span className="text-sm font-medium tabular-nums">${calculateTotalCost().toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription className="text-sm">
                      No ingredients added yet. Search and select ingredients to add them to your recipe.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-add-recipe"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || recipeIngredients.length === 0}
                data-testid="button-submit-add-recipe"
              >
                {isLoading ? "Creating..." : "Create Recipe"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
