import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Ingredient, InsertIngredient } from "@shared/schema";
import { measurementUnits } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Zap, TrendingUp, TrendingDown, Minus, DollarSign, Package, Percent, Check, X, Edit2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function AdditionsPricingPage() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    additionPortionSize?: number;
    additionPortionUnit?: string;
    additionMenuPrice?: number;
  }>({});

  const { data: ingredients = [], isLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const additions = ingredients.filter(ing => ing.isAddition);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertIngredient> }) => {
      return apiRequest(`/api/ingredients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      toast({
        title: "Add-in pricing updated",
        description: "The pricing for this add-in has been saved.",
      });
      setEditingId(null);
      setEditValues({});
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update add-in pricing.",
        variant: "destructive",
      });
    },
  });

  // Calculate portion cost based on ingredient cost data
  const calculatePortionCost = (ingredient: Ingredient): number | null => {
    if (!ingredient.additionPortionSize || !ingredient.additionPortionUnit) {
      return null;
    }

    const portionSize = ingredient.additionPortionSize;
    const portionUnit = ingredient.additionPortionUnit.toLowerCase();

    // Get the appropriate cost per unit based on portion unit
    // Handle both spelled-out units (from measurementUnits) and abbreviations
    let costPerUnit: number | null = null;
    switch (portionUnit) {
      case "g":
      case "grams":
        costPerUnit = ingredient.costPerGram;
        break;
      case "oz":
      case "ounces":
        costPerUnit = ingredient.costPerOunce;
        break;
      case "cup":
      case "cups":
        costPerUnit = ingredient.costPerCup;
        break;
      case "tbsp":
      case "tablespoons":
        costPerUnit = ingredient.costPerTbsp;
        break;
      case "tsp":
      case "teaspoons":
        costPerUnit = ingredient.costPerTsp;
        break;
      case "lb":
      case "pounds":
        costPerUnit = ingredient.costPerPound;
        break;
      case "kg":
        costPerUnit = ingredient.costPerKg;
        break;
      case "ml":
        costPerUnit = ingredient.costPerMl;
        break;
      case "liter":
      case "liters":
        costPerUnit = ingredient.costPerLiter;
        break;
      case "pint":
      case "pints":
        costPerUnit = ingredient.costPerPint;
        break;
      case "quart":
      case "quarts":
        costPerUnit = ingredient.costPerQuart;
        break;
      case "gallon":
      case "gallons":
        costPerUnit = ingredient.costPerGallon;
        break;
      case "unit":
      case "units":
        costPerUnit = ingredient.costPerUnit;
        break;
      default:
        // Try to use gram cost if available
        costPerUnit = ingredient.costPerGram;
    }

    if (costPerUnit === null || costPerUnit === undefined) {
      return null;
    }

    return portionSize * costPerUnit;
  };

  // Calculate margin
  const calculateMargin = (ingredient: Ingredient): number | null => {
    const portionCost = calculatePortionCost(ingredient);
    const menuPrice = ingredient.additionMenuPrice;

    if (portionCost === null || portionCost === 0 || !menuPrice) {
      return null;
    }

    return ((menuPrice - portionCost) / menuPrice) * 100;
  };

  const startEdit = (ingredient: Ingredient) => {
    setEditingId(ingredient.id);
    setEditValues({
      additionPortionSize: ingredient.additionPortionSize ?? undefined,
      additionPortionUnit: ingredient.additionPortionUnit ?? undefined,
      additionMenuPrice: ingredient.additionMenuPrice ?? undefined,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = (ingredient: Ingredient) => {
    updateMutation.mutate({
      id: ingredient.id,
      data: {
        name: ingredient.name,
        category: ingredient.category,
        purchaseQuantity: ingredient.purchaseQuantity,
        purchaseUnit: ingredient.purchaseUnit,
        purchaseCost: ingredient.purchaseCost,
        isPackaging: ingredient.isPackaging,
        isAddition: ingredient.isAddition,
        store: ingredient.store ?? undefined,
        pricePerUnit: ingredient.pricePerUnit ?? undefined,
        gramsPerMilliliter: ingredient.gramsPerMilliliter ?? undefined,
        densitySource: ingredient.densitySource ?? undefined,
        yieldPercentage: ingredient.yieldPercentage ?? 97,
        additionPortionSize: editValues.additionPortionSize,
        additionPortionUnit: editValues.additionPortionUnit,
        additionMenuPrice: editValues.additionMenuPrice,
      },
    });
  };

  const getMarginColor = (margin: number | null) => {
    if (margin === null) return "text-muted-foreground";
    if (margin >= 70) return "text-emerald-600 dark:text-emerald-400";
    if (margin >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getMarginIcon = (margin: number | null) => {
    if (margin === null) return <Minus className="h-4 w-4" />;
    if (margin >= 70) return <TrendingUp className="h-4 w-4" />;
    if (margin >= 50) return <Minus className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  // Summary stats
  const additionsWithPricing = additions.filter(a => 
    a.additionPortionSize && a.additionPortionUnit && a.additionMenuPrice
  );
  const avgMargin = additionsWithPricing.length > 0
    ? additionsWithPricing.reduce((sum, a) => sum + (calculateMargin(a) ?? 0), 0) / additionsWithPricing.length
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-additions-title">
          <Zap className="h-6 w-6 text-primary" />
          Add-Ins Pricing
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure pricing for add-in ingredients like protein powders, supplements, and extras
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Add-Ins</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-additions">
              {additions.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>With Pricing Set</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-priced-additions">
              {additionsWithPricing.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Margin</CardDescription>
            <CardTitle className={`text-3xl flex items-center gap-2 ${getMarginColor(avgMargin)}`} data-testid="text-avg-margin">
              {avgMargin > 0 ? `${avgMargin.toFixed(1)}%` : "-"}
              {getMarginIcon(avgMargin > 0 ? avgMargin : null)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add-In Pricing Details
          </CardTitle>
          <CardDescription>
            Set portion sizes and menu prices for each add-in to calculate margins
          </CardDescription>
        </CardHeader>
        <CardContent>
          {additions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No add-ins configured yet</p>
              <p className="text-sm mt-1">
                Mark ingredients as "Add-In" in the Ingredients page to see them here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Add-In Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Purchase Info</TableHead>
                    <TableHead className="text-right">Portion Size</TableHead>
                    <TableHead className="text-right">Portion Cost</TableHead>
                    <TableHead className="text-right">Menu Price</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {additions.map((ingredient) => {
                    const isEditing = editingId === ingredient.id;
                    const portionCost = calculatePortionCost(ingredient);
                    const margin = calculateMargin(ingredient);

                    return (
                      <TableRow key={ingredient.id} data-testid={`row-addition-${ingredient.id}`}>
                        <TableCell className="font-medium" data-testid={`text-addition-name-${ingredient.id}`}>
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            {ingredient.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {ingredient.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ingredient.purchaseQuantity} {ingredient.purchaseUnit} @ ${ingredient.purchaseCost.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Input
                                type="number"
                                step="0.01"
                                value={editValues.additionPortionSize ?? ""}
                                onChange={(e) => setEditValues({
                                  ...editValues,
                                  additionPortionSize: e.target.value ? parseFloat(e.target.value) : undefined,
                                })}
                                placeholder="Size"
                                className="h-8 w-16 text-right"
                                data-testid={`input-portion-size-${ingredient.id}`}
                              />
                              <Select
                                value={editValues.additionPortionUnit ?? ""}
                                onValueChange={(val) => setEditValues({
                                  ...editValues,
                                  additionPortionUnit: val,
                                })}
                              >
                                <SelectTrigger className="h-8 w-20" data-testid={`select-portion-unit-${ingredient.id}`}>
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
                          ) : (
                            <span data-testid={`text-portion-size-${ingredient.id}`}>
                              {ingredient.additionPortionSize && ingredient.additionPortionUnit
                                ? `${ingredient.additionPortionSize} ${ingredient.additionPortionUnit}`
                                : <span className="text-muted-foreground">Not set</span>
                              }
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums" data-testid={`text-portion-cost-${ingredient.id}`}>
                          {portionCost !== null ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="font-medium">${portionCost.toFixed(3)}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Cost per portion based on ingredient pricing
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-muted-foreground">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={editValues.additionMenuPrice ?? ""}
                                onChange={(e) => setEditValues({
                                  ...editValues,
                                  additionMenuPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                                })}
                                placeholder="Price"
                                className="h-8 w-20 text-right"
                                data-testid={`input-menu-price-${ingredient.id}`}
                              />
                            </div>
                          ) : (
                            <span className="font-medium tabular-nums" data-testid={`text-menu-price-${ingredient.id}`}>
                              {ingredient.additionMenuPrice
                                ? `$${ingredient.additionMenuPrice.toFixed(2)}`
                                : <span className="text-muted-foreground">Not set</span>
                              }
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`flex items-center justify-end gap-1 font-semibold ${getMarginColor(margin)}`} data-testid={`text-margin-${ingredient.id}`}>
                            {getMarginIcon(margin)}
                            {margin !== null ? `${margin.toFixed(1)}%` : "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => saveEdit(ingredient)}
                                disabled={updateMutation.isPending}
                                data-testid={`button-save-${ingredient.id}`}
                              >
                                <Check className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={cancelEdit}
                                data-testid={`button-cancel-${ingredient.id}`}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEdit(ingredient)}
                              data-testid={`button-edit-${ingredient.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Understanding Add-In Margins
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Portion Size:</strong> The amount of the add-in used per serving (e.g., "30 g" for a scoop of whey protein)
          </p>
          <p>
            <strong>Portion Cost:</strong> Calculated automatically from your ingredient cost data based on the portion size
          </p>
          <p>
            <strong>Menu Price:</strong> What you charge customers for this add-in
          </p>
          <p>
            <strong>Margin:</strong> The percentage of revenue that is profit. 
            <span className="text-emerald-600 dark:text-emerald-400"> Green (70%+)</span> is excellent,
            <span className="text-amber-600 dark:text-amber-400"> Yellow (50-70%)</span> is acceptable,
            <span className="text-red-600 dark:text-red-400"> Red (&lt;50%)</span> may need adjustment
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
