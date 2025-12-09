import { useState, useMemo } from "react";
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
import { Zap, TrendingUp, TrendingDown, Minus, DollarSign, Package, Percent, Check, X, Edit2, Search, ArrowUpDown, ArrowUp, ArrowDown, Link2, Unlink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SortField = "name" | "category" | "portionCost" | "menuPrice" | "margin";
type SortDirection = "asc" | "desc";

export default function AdditionsPricingPage() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    additionPortionSize?: number;
    additionPortionUnit?: string;
    additionMenuPrice?: number;
    additionBaseIngredientId?: string | null;
    additionBasePortionRatio?: number;
  }>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { data: ingredients = [], isLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const additions = ingredients.filter(ing => ing.isAddition);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertIngredient> }) => {
      return apiRequest("PATCH", `/api/ingredients/${id}`, data);
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

  // Calculate base cost (the ingredient being replaced/upgraded from)
  const calculateBaseCost = (ingredient: Ingredient): number | null => {
    if (!ingredient.additionBaseIngredientId) {
      return null;
    }

    const baseIngredient = ingredients.find(i => i.id === ingredient.additionBaseIngredientId);
    if (!baseIngredient) {
      return null;
    }

    // Use the same portion unit and size but with ratio applied
    const portionSize = ingredient.additionPortionSize;
    const portionUnit = ingredient.additionPortionUnit?.toLowerCase();
    const ratio = ingredient.additionBasePortionRatio ?? 1.0;

    if (!portionSize || !portionUnit) {
      return null;
    }

    // Get the appropriate cost per unit from base ingredient
    let costPerUnit: number | null = null;
    switch (portionUnit) {
      case "g":
      case "grams":
        costPerUnit = baseIngredient.costPerGram;
        break;
      case "oz":
      case "ounces":
        costPerUnit = baseIngredient.costPerOunce;
        break;
      case "cup":
      case "cups":
        costPerUnit = baseIngredient.costPerCup;
        break;
      case "tbsp":
      case "tablespoons":
        costPerUnit = baseIngredient.costPerTbsp;
        break;
      case "tsp":
      case "teaspoons":
        costPerUnit = baseIngredient.costPerTsp;
        break;
      case "lb":
      case "pounds":
        costPerUnit = baseIngredient.costPerPound;
        break;
      case "kg":
        costPerUnit = baseIngredient.costPerKg;
        break;
      case "ml":
        costPerUnit = baseIngredient.costPerMl;
        break;
      case "liter":
      case "liters":
        costPerUnit = baseIngredient.costPerLiter;
        break;
      case "pint":
      case "pints":
        costPerUnit = baseIngredient.costPerPint;
        break;
      case "quart":
      case "quarts":
        costPerUnit = baseIngredient.costPerQuart;
        break;
      case "gallon":
      case "gallons":
        costPerUnit = baseIngredient.costPerGallon;
        break;
      case "unit":
      case "units":
        costPerUnit = baseIngredient.costPerUnit;
        break;
      default:
        costPerUnit = baseIngredient.costPerGram;
    }

    if (costPerUnit === null || costPerUnit === undefined) {
      return null;
    }

    return portionSize * ratio * costPerUnit;
  };

  // Calculate upgrade cost (portion cost minus base cost)
  const calculateUpgradeCost = (ingredient: Ingredient): number | null => {
    const portionCost = calculatePortionCost(ingredient);
    const baseCost = calculateBaseCost(ingredient);

    if (portionCost === null) {
      return null;
    }

    // If no base ingredient, upgrade cost equals portion cost
    if (baseCost === null) {
      return portionCost;
    }

    return portionCost - baseCost;
  };

  // Calculate upgrade margin (based on upgrade cost instead of portion cost)
  const calculateUpgradeMargin = (ingredient: Ingredient): number | null => {
    const upgradeCost = calculateUpgradeCost(ingredient);
    const menuPrice = ingredient.additionMenuPrice;

    if (upgradeCost === null || menuPrice === null || menuPrice === undefined || menuPrice === 0) {
      return null;
    }

    return ((menuPrice - upgradeCost) / menuPrice) * 100;
  };

  // Get base ingredient name for display
  const getBaseIngredientName = (ingredient: Ingredient): string | null => {
    if (!ingredient.additionBaseIngredientId) {
      return null;
    }
    const baseIngredient = ingredients.find(i => i.id === ingredient.additionBaseIngredientId);
    return baseIngredient?.name ?? null;
  };

  // Get non-addition ingredients (potential base ingredients for upgrades)
  const potentialBaseIngredients = useMemo(() => {
    return ingredients.filter(ing => !ing.isAddition && !ing.isPackaging);
  }, [ingredients]);

  // Toggle sort for a column
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Get sort icon for column header
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Filter and sort additions
  const filteredAndSortedAdditions = useMemo(() => {
    let result = [...additions];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (ing) =>
          ing.name.toLowerCase().includes(query) ||
          ing.category.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        let aValue: string | number | null = null;
        let bValue: string | number | null = null;

        switch (sortField) {
          case "name":
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case "category":
            aValue = a.category.toLowerCase();
            bValue = b.category.toLowerCase();
            break;
          case "portionCost":
            aValue = calculatePortionCost(a);
            bValue = calculatePortionCost(b);
            break;
          case "menuPrice":
            aValue = a.additionMenuPrice;
            bValue = b.additionMenuPrice;
            break;
          case "margin":
            aValue = calculateMargin(a);
            bValue = calculateMargin(b);
            break;
        }

        // Handle nulls - put them at the end
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;

        // Compare
        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortDirection === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        return sortDirection === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      });
    }

    return result;
  }, [additions, searchQuery, sortField, sortDirection]);

  const startEdit = (ingredient: Ingredient) => {
    setEditingId(ingredient.id);
    setEditValues({
      additionPortionSize: ingredient.additionPortionSize ?? undefined,
      additionPortionUnit: ingredient.additionPortionUnit ?? undefined,
      additionMenuPrice: ingredient.additionMenuPrice ?? undefined,
      additionBaseIngredientId: ingredient.additionBaseIngredientId ?? null,
      additionBasePortionRatio: ingredient.additionBasePortionRatio ?? 1.0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = (ingredient: Ingredient) => {
    // Build the update data, explicitly handling null for base ingredient to clear it
    const updateData: Partial<InsertIngredient> & { additionBaseIngredientId?: string | null } = {
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
      additionBasePortionRatio: editValues.additionBasePortionRatio,
    };
    
    // Explicitly include additionBaseIngredientId even when null to clear it
    // Use null to signal removal, undefined to leave unchanged
    if (editValues.additionBaseIngredientId === null) {
      updateData.additionBaseIngredientId = null;
    } else if (editValues.additionBaseIngredientId) {
      updateData.additionBaseIngredientId = editValues.additionBaseIngredientId;
    }
    
    updateMutation.mutate({
      id: ingredient.id,
      data: updateData,
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Add-In Pricing Details
              </CardTitle>
              <CardDescription>
                Set portion sizes and menu prices for each add-in to calculate margins
              </CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search add-ins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-addins"
              />
            </div>
          </div>
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
                    <TableHead>
                      <button
                        onClick={() => toggleSort("name")}
                        className="flex items-center hover-elevate px-1 py-0.5 rounded -ml-1"
                        data-testid="sort-name"
                      >
                        Add-In Name
                        {getSortIcon("name")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => toggleSort("category")}
                        className="flex items-center hover-elevate px-1 py-0.5 rounded -ml-1"
                        data-testid="sort-category"
                      >
                        Category
                        {getSortIcon("category")}
                      </button>
                    </TableHead>
                    <TableHead>Purchase Info</TableHead>
                    <TableHead className="text-right">Portion Size</TableHead>
                    <TableHead className="text-right">
                      <button
                        onClick={() => toggleSort("portionCost")}
                        className="flex items-center justify-end hover-elevate px-1 py-0.5 rounded ml-auto"
                        data-testid="sort-portion-cost"
                      >
                        Portion Cost
                        {getSortIcon("portionCost")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        onClick={() => toggleSort("menuPrice")}
                        className="flex items-center justify-end hover-elevate px-1 py-0.5 rounded ml-auto"
                        data-testid="sort-menu-price"
                      >
                        Menu Price
                        {getSortIcon("menuPrice")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          <span>Base Item</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          The ingredient this add-in replaces (e.g., regular milk for oat milk upgrade)
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-right">
                      <Tooltip>
                        <TooltipTrigger>Upgrade Cost</TooltipTrigger>
                        <TooltipContent>
                          Add-in cost minus base item cost = true upgrade cost
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        onClick={() => toggleSort("margin")}
                        className="flex items-center justify-end hover-elevate px-1 py-0.5 rounded ml-auto"
                        data-testid="sort-margin"
                      >
                        Upgrade Margin
                        {getSortIcon("margin")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedAdditions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No add-ins match your search "{searchQuery}"
                      </TableCell>
                    </TableRow>
                  ) : filteredAndSortedAdditions.map((ingredient) => {
                    const isEditing = editingId === ingredient.id;
                    const portionCost = calculatePortionCost(ingredient);
                    const baseCost = calculateBaseCost(ingredient);
                    const upgradeCost = calculateUpgradeCost(ingredient);
                    const upgradeMargin = calculateUpgradeMargin(ingredient);
                    const baseIngredientName = getBaseIngredientName(ingredient);

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
                        {/* Base Item Column */}
                        <TableCell>
                          {isEditing ? (
                            <Select
                              value={editValues.additionBaseIngredientId ?? "none"}
                              onValueChange={(val) => setEditValues({
                                ...editValues,
                                additionBaseIngredientId: val === "none" ? null : val,
                              })}
                            >
                              <SelectTrigger className="h-8 w-36" data-testid={`select-base-ingredient-${ingredient.id}`}>
                                <SelectValue placeholder="No base item" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  <span className="flex items-center gap-1 text-muted-foreground">
                                    <Unlink className="h-3 w-3" />
                                    No base item
                                  </span>
                                </SelectItem>
                                {potentialBaseIngredients.map((baseIng) => (
                                  <SelectItem key={baseIng.id} value={baseIng.id}>
                                    {baseIng.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span data-testid={`text-base-ingredient-${ingredient.id}`}>
                              {baseIngredientName ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="font-normal gap-1">
                                      <Link2 className="h-3 w-3" />
                                      {baseIngredientName}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Base cost: ${baseCost?.toFixed(3) ?? "-"}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </span>
                          )}
                        </TableCell>
                        {/* Upgrade Cost Column */}
                        <TableCell className="text-right tabular-nums" data-testid={`text-upgrade-cost-${ingredient.id}`}>
                          {upgradeCost !== null ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className={`font-medium ${baseCost !== null ? 'text-primary' : ''}`}>
                                  ${upgradeCost.toFixed(3)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {baseCost !== null 
                                  ? `$${portionCost?.toFixed(3)} (add-in) - $${baseCost.toFixed(3)} (base) = $${upgradeCost.toFixed(3)}`
                                  : 'No base item set - showing full portion cost'}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        {/* Upgrade Margin Column */}
                        <TableCell className="text-right">
                          <div className={`flex items-center justify-end gap-1 font-semibold ${getMarginColor(upgradeMargin)}`} data-testid={`text-margin-${ingredient.id}`}>
                            {getMarginIcon(upgradeMargin)}
                            {upgradeMargin !== null ? `${upgradeMargin.toFixed(1)}%` : "-"}
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
            <strong>Base Item:</strong> For upgrade-style add-ins (like oat milk replacing regular milk), select the ingredient being replaced. This allows accurate margin calculations.
          </p>
          <p>
            <strong>Upgrade Cost:</strong> The true cost of the upgrade = Add-in portion cost minus base item cost. If no base item is set, this equals the full portion cost.
          </p>
          <p>
            <strong>Upgrade Margin:</strong> The percentage of revenue that is profit after accounting for base item replacement. 
            <span className="text-emerald-600 dark:text-emerald-400"> Green (70%+)</span> is excellent,
            <span className="text-amber-600 dark:text-amber-400"> Yellow (50-70%)</span> is acceptable,
            <span className="text-red-600 dark:text-red-400"> Red (&lt;50%)</span> may need adjustment
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
