import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calculator, TrendingUp, DollarSign, AlertTriangle, Check, Percent, Package, Settings2, Wand2, Search, X, Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Recipe, CategoryPricingSettings, RecipeCategory } from "@shared/schema";
import { calculateSuggestedPrice, calculateTrueCost, recipeCategories, recipeCategoryLabels } from "@shared/schema";

type CategorySettings = Record<RecipeCategory, { wastePercentage: number; targetMargin: number }>;

const defaultCategorySettings: CategorySettings = {
  food: { wastePercentage: 15, targetMargin: 80 },
  drink: { wastePercentage: 10, targetMargin: 85 },
  seasonal_food: { wastePercentage: 20, targetMargin: 75 },
  seasonal_drink: { wastePercentage: 15, targetMargin: 80 },
  other: { wastePercentage: 15, targetMargin: 80 },
};

export default function PricingPlaygroundPage() {
  const { toast } = useToast();
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [wastePercentage, setWastePercentage] = useState<number>(0);
  const [targetMargin, setTargetMargin] = useState<number>(80);
  const [consumablesBuffer, setConsumablesBuffer] = useState<number>(0);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [globalWaste, setGlobalWaste] = useState<number>(15);
  const [globalTargetMargin, setGlobalTargetMargin] = useState<number>(80);
  const [minimumMarginThreshold, setMinimumMarginThreshold] = useState<number>(80);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categorySettings, setCategorySettings] = useState<CategorySettings>(defaultCategorySettings);

  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: savedCategorySettings = [] } = useQuery<CategoryPricingSettings[]>({
    queryKey: ["/api/pricing-settings"],
  });

  // Update local category settings when saved settings are fetched
  useEffect(() => {
    if (savedCategorySettings.length > 0) {
      const updated = { ...defaultCategorySettings };
      savedCategorySettings.forEach(setting => {
        if (setting.category in updated) {
          updated[setting.category as RecipeCategory] = {
            wastePercentage: setting.wastePercentage,
            targetMargin: setting.targetMargin,
          };
        }
      });
      setCategorySettings(updated);
    }
  }, [savedCategorySettings]);

  const selectedRecipe = useMemo(() => {
    return recipes.find(r => r.id === selectedRecipeId);
  }, [recipes, selectedRecipeId]);

  const handleRecipeSelect = (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe) {
      setSelectedRecipeId(recipeId);
      setWastePercentage(recipe.wastePercentage ?? 0);
      setTargetMargin(recipe.targetMargin ?? 80);
      setConsumablesBuffer(recipe.consumablesBuffer ?? 0);
      setHasChanges(false);
    }
  };

  const baseCost = selectedRecipe?.costPerServing ?? 0;
  const trueCost = calculateTrueCost(baseCost, wastePercentage, consumablesBuffer);
  const suggestedPrice = calculateSuggestedPrice(baseCost, wastePercentage, targetMargin, consumablesBuffer);
  const currentMenuPrice = selectedRecipe?.menuPrice ?? 0;
  const priceDifference = suggestedPrice - currentMenuPrice;
  const actualMargin = currentMenuPrice > 0 
    ? ((currentMenuPrice - trueCost) / currentMenuPrice) * 100 
    : 0;

  const updatePricingMutation = useMutation({
    mutationFn: async (data: { 
      recipeId: string; 
      wastePercentage: number; 
      targetMargin: number; 
      consumablesBuffer: number;
      menuPrice?: number;
    }) => {
      const response = await apiRequest("PATCH", `/api/recipes/${data.recipeId}/pricing`, {
        wastePercentage: data.wastePercentage,
        targetMargin: data.targetMargin,
        consumablesBuffer: data.consumablesBuffer,
        menuPrice: data.menuPrice,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setHasChanges(false);
      toast({
        title: "Pricing Updated",
        description: "Recipe pricing settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update pricing settings.",
        variant: "destructive",
      });
    },
  });

  const applyGlobalWasteMutation = useMutation({
    mutationFn: async (wasteValue: number) => {
      const updates = recipes.map(recipe => 
        apiRequest("PATCH", `/api/recipes/${recipe.id}/pricing`, {
          wastePercentage: wasteValue,
          targetMargin: recipe.targetMargin ?? 80,
          consumablesBuffer: recipe.consumablesBuffer ?? 0,
        })
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      if (selectedRecipeId) {
        setWastePercentage(globalWaste);
      }
      toast({
        title: "Global Waste Applied",
        description: `Waste percentage set to ${globalWaste}% for all ${recipes.length} recipes.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply global waste percentage.",
        variant: "destructive",
      });
    },
  });

  const applyGlobalTargetMarginMutation = useMutation({
    mutationFn: async (marginValue: number) => {
      const updates = recipes.map(recipe => 
        apiRequest("PATCH", `/api/recipes/${recipe.id}/pricing`, {
          wastePercentage: recipe.wastePercentage ?? 0,
          targetMargin: marginValue,
          consumablesBuffer: recipe.consumablesBuffer ?? 0,
        })
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      if (selectedRecipeId) {
        setTargetMargin(globalTargetMargin);
      }
      toast({
        title: "Global Target Margin Applied",
        description: `Target profit margin set to ${globalTargetMargin}% for all ${recipes.length} recipes.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply global target margin.",
        variant: "destructive",
      });
    },
  });

  const applyCategorySettingsMutation = useMutation({
    mutationFn: async ({ category, wastePercentage, targetMargin }: { 
      category: RecipeCategory | "global"; 
      wastePercentage: number; 
      targetMargin: number 
    }) => {
      const response = await apiRequest("POST", "/api/pricing-settings/apply", {
        category,
        wastePercentage,
        targetMargin,
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-settings"] });
      const categoryLabel = variables.category === "global" 
        ? "all recipes" 
        : recipeCategoryLabels[variables.category as RecipeCategory];
      toast({
        title: "Settings Applied",
        description: `Updated ${data.updatedCount} ${categoryLabel} with ${variables.wastePercentage}% waste and ${variables.targetMargin}% target margin.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply category settings.",
        variant: "destructive",
      });
    },
  });

  const handleCategorySettingChange = (category: RecipeCategory, field: "wastePercentage" | "targetMargin", value: number) => {
    setCategorySettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  };

  const getRecipeCountByCategory = (category: RecipeCategory): number => {
    return recipes.filter(r => r.category === category).length;
  };

  const recipesWithMetrics = useMemo(() => {
    return recipes.map(recipe => {
      const recipeTrueCost = calculateTrueCost(
        recipe.costPerServing,
        recipe.wastePercentage ?? 0,
        recipe.consumablesBuffer ?? 0
      );
      const recipeSuggested = calculateSuggestedPrice(
        recipe.costPerServing,
        recipe.wastePercentage ?? 0,
        recipe.targetMargin ?? 80,
        recipe.consumablesBuffer ?? 0
      );
      const recipeMargin = (recipe.menuPrice ?? 0) > 0
        ? (((recipe.menuPrice ?? 0) - recipeTrueCost) / (recipe.menuPrice ?? 0)) * 100
        : 0;
      const isBelowMinMargin = (recipe.menuPrice ?? 0) > 0 && recipeMargin < minimumMarginThreshold;
      const isOnTarget = (recipe.menuPrice ?? 0) > 0 && recipeMargin >= (recipe.targetMargin ?? 80) - 5;
      
      return {
        ...recipe,
        trueCost: recipeTrueCost,
        suggestedPrice: recipeSuggested,
        margin: recipeMargin,
        isBelowMinMargin,
        isOnTarget,
      };
    });
  }, [recipes, minimumMarginThreshold]);

  const flaggedRecipesCount = useMemo(() => {
    return recipesWithMetrics.filter(r => r.isBelowMinMargin).length;
  }, [recipesWithMetrics]);

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) {
      return recipesWithMetrics;
    }
    const query = searchQuery.toLowerCase();
    return recipesWithMetrics.filter(recipe =>
      recipe.name.toLowerCase().includes(query) ||
      (recipe.category && recipe.category.toLowerCase().includes(query))
    );
  }, [recipesWithMetrics, searchQuery]);

  const handleSave = () => {
    if (!selectedRecipeId) return;
    updatePricingMutation.mutate({
      recipeId: selectedRecipeId,
      wastePercentage,
      targetMargin,
      consumablesBuffer,
    });
  };

  const handleApplySuggestedPrice = () => {
    if (!selectedRecipeId) return;
    updatePricingMutation.mutate({
      recipeId: selectedRecipeId,
      wastePercentage,
      targetMargin,
      consumablesBuffer,
      menuPrice: suggestedPrice,
    });
  };

  const handleSliderChange = (setter: (value: number) => void) => (values: number[]) => {
    setter(values[0]);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading recipes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pricing Playground</h1>
        <p className="text-muted-foreground mt-1">
          Calculate true costs and suggested pricing that accounts for waste, shrinkage, and profit margins
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Pricing Settings
          </CardTitle>
          <CardDescription>
            Apply waste and margin settings globally or by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="global" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="global" data-testid="tab-global">
                <Settings2 className="h-4 w-4 mr-2" />
                Global
              </TabsTrigger>
              <TabsTrigger value="category" data-testid="tab-category">
                <Layers className="h-4 w-4 mr-2" />
                By Category
              </TabsTrigger>
            </TabsList>

            <TabsContent value="global" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted">Global Waste %</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Set a uniform waste percentage for all recipes. Useful when you want to apply the same shrinkage rate across your entire menu.</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <span className="font-medium tabular-nums" data-testid="text-global-waste">{globalWaste}%</span>
                    </div>
                    <Slider
                      value={[globalWaste]}
                      onValueChange={(values) => setGlobalWaste(values[0])}
                      max={50}
                      step={1}
                      data-testid="slider-global-waste"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0% (No waste)</span>
                      <span>50% (Heavy waste)</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted">Global Target Margin %</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Set a uniform target profit margin for all recipes. This will recalculate suggested prices across your entire menu based on this target.</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <span className="font-medium tabular-nums" data-testid="text-global-margin">{globalTargetMargin}%</span>
                    </div>
                    <Slider
                      value={[globalTargetMargin]}
                      onValueChange={(values) => setGlobalTargetMargin(values[0])}
                      max={95}
                      min={10}
                      step={1}
                      data-testid="slider-global-margin"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>10% (Low margin)</span>
                      <span>95% (High margin)</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => applyCategorySettingsMutation.mutate({
                      category: "global",
                      wastePercentage: globalWaste,
                      targetMargin: globalTargetMargin,
                    })}
                    disabled={applyCategorySettingsMutation.isPending || recipes.length === 0}
                    className="w-full"
                    data-testid="button-apply-global-settings"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    {applyCategorySettingsMutation.isPending 
                      ? "Applying..." 
                      : `Apply to All ${recipes.length} Recipes`
                    }
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted">Minimum Margin Threshold</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Items with margins below this threshold will be flagged in the overview table. Use this to quickly identify underperforming menu items.</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <span className="font-medium tabular-nums" data-testid="text-min-margin-threshold">{minimumMarginThreshold}%</span>
                    </div>
                    <Slider
                      value={[minimumMarginThreshold]}
                      onValueChange={(values) => setMinimumMarginThreshold(values[0])}
                      max={95}
                      min={10}
                      step={5}
                      data-testid="slider-min-margin"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>10% (Low)</span>
                      <span>95% (High)</span>
                    </div>
                  </div>
                  {flaggedRecipesCount > 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-700 dark:text-red-400">
                        {flaggedRecipesCount} {flaggedRecipesCount === 1 ? "recipe" : "recipes"} below {minimumMarginThreshold}% margin
                      </span>
                    </div>
                  ) : recipes.length > 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700 dark:text-green-400">
                        All priced recipes meet minimum margin threshold
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="category" className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Set different waste and margin targets for each recipe category. Changes are applied when you click the button for each category.
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recipeCategories.map((category) => {
                  const settings = categorySettings[category];
                  const recipeCount = getRecipeCountByCategory(category);
                  return (
                    <Card key={category} className="relative">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between gap-2">
                          <span>{recipeCategoryLabels[category]}</span>
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-count-${category}`}>
                            {recipeCount} {recipeCount === 1 ? "recipe" : "recipes"}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Waste %</Label>
                            <span className="text-sm font-medium tabular-nums" data-testid={`text-waste-${category}`}>
                              {settings.wastePercentage}%
                            </span>
                          </div>
                          <Slider
                            value={[settings.wastePercentage]}
                            onValueChange={(values) => handleCategorySettingChange(category, "wastePercentage", values[0])}
                            max={50}
                            step={1}
                            data-testid={`slider-waste-${category}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Target Margin %</Label>
                            <span className="text-sm font-medium tabular-nums" data-testid={`text-margin-${category}`}>
                              {settings.targetMargin}%
                            </span>
                          </div>
                          <Slider
                            value={[settings.targetMargin]}
                            onValueChange={(values) => handleCategorySettingChange(category, "targetMargin", values[0])}
                            max={95}
                            min={10}
                            step={1}
                            data-testid={`slider-margin-${category}`}
                          />
                        </div>
                        <Button
                          onClick={() => applyCategorySettingsMutation.mutate({
                            category,
                            wastePercentage: settings.wastePercentage,
                            targetMargin: settings.targetMargin,
                          })}
                          disabled={applyCategorySettingsMutation.isPending || recipeCount === 0}
                          size="sm"
                          className="w-full"
                          data-testid={`button-apply-${category}`}
                        >
                          <Wand2 className="h-3 w-3 mr-2" />
                          {applyCategorySettingsMutation.isPending 
                            ? "Applying..." 
                            : `Apply to ${recipeCategoryLabels[category]}`
                          }
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Select Recipe
            </CardTitle>
            <CardDescription>Choose a recipe to analyze pricing</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedRecipeId ?? ""} onValueChange={handleRecipeSelect}>
              <SelectTrigger data-testid="select-recipe">
                <SelectValue placeholder="Select a recipe..." />
              </SelectTrigger>
              <SelectContent>
                {recipes.length === 0 ? (
                  <SelectItem value="no-recipes" disabled>
                    No recipes available
                  </SelectItem>
                ) : (
                  recipes.map((recipe) => (
                    <SelectItem key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedRecipe && (
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Category</span>
                  <Badge variant="secondary" data-testid="text-recipe-category">{selectedRecipe.category}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Servings</span>
                  <span className="font-medium" data-testid="text-recipe-servings">{selectedRecipe.servings}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Base Cost/Serving</span>
                  <span className="font-medium tabular-nums" data-testid="text-base-cost">${baseCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Current Menu Price</span>
                  <span className="font-medium tabular-nums" data-testid="text-current-price">
                    {currentMenuPrice > 0 ? `$${currentMenuPrice.toFixed(2)}` : "Not set"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Pricing Factors
            </CardTitle>
            <CardDescription>
              Adjust these factors to see how they affect your recommended price
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedRecipe ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p>Select a recipe to begin calculating pricing</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted">Waste/Shrinkage %</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Account for product loss from spoilage, spills, calibration, misorders, theft, and training waste. Typical coffee shop waste is 10-20%.</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <span className="font-medium tabular-nums" data-testid="text-waste-percentage">{wastePercentage}%</span>
                    </div>
                    <Slider
                      value={[wastePercentage]}
                      onValueChange={handleSliderChange(setWastePercentage)}
                      max={50}
                      step={1}
                      data-testid="slider-waste"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0% (No waste)</span>
                      <span>50% (Heavy waste)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted">Target Profit Margin %</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>The percentage of the selling price that is profit after covering true costs. Industry standard for coffee shops is 65-80%.</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <span className="font-medium tabular-nums" data-testid="text-target-margin">{targetMargin}%</span>
                    </div>
                    <Slider
                      value={[targetMargin]}
                      onValueChange={handleSliderChange(setTargetMargin)}
                      max={95}
                      min={10}
                      step={1}
                      data-testid="slider-margin"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>10% (Low margin)</span>
                      <span>95% (High margin)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted">Consumables Buffer ($)</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Flat cost for non-recipe items like cups, lids, sleeves, napkins, straws, and sugar packets.</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min={0}
                          max={5}
                          step={0.01}
                          value={consumablesBuffer}
                          onChange={(e) => {
                            setConsumablesBuffer(parseFloat(e.target.value) || 0);
                            setHasChanges(true);
                          }}
                          className="w-20 h-8 text-right"
                          data-testid="input-consumables"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Typical: $0.05-$0.25 for cups/lids/napkins
                    </p>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground">True Cost</span>
                          <span className="text-2xl font-bold tabular-nums" data-testid="text-true-cost">
                            ${trueCost.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Base + waste + consumables
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="pt-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground">Suggested Price</span>
                          <span className="text-2xl font-bold tabular-nums text-primary" data-testid="text-suggested-price">
                            ${suggestedPrice.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            At {targetMargin}% margin
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={currentMenuPrice > 0 ? (
                      actualMargin >= targetMargin - 5 ? "bg-green-500/10 border-green-500/20" : "bg-orange-500/10 border-orange-500/20"
                    ) : "bg-muted/50"}>
                      <CardContent className="pt-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground">Actual Margin</span>
                          <span className={`text-2xl font-bold tabular-nums ${
                            currentMenuPrice > 0 ? (
                              actualMargin >= targetMargin - 5 ? "text-green-600" : "text-orange-600"
                            ) : ""
                          }`} data-testid="text-actual-margin">
                            {currentMenuPrice > 0 ? `${actualMargin.toFixed(1)}%` : "N/A"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {currentMenuPrice > 0 ? (
                              actualMargin >= targetMargin ? "On target" : "Below target"
                            ) : "Set menu price"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {currentMenuPrice > 0 && Math.abs(priceDifference) > 0.01 && (
                  <div className={`flex items-start gap-3 p-4 rounded-lg ${
                    priceDifference > 0 
                      ? "bg-orange-500/10 border border-orange-500/20" 
                      : "bg-green-500/10 border border-green-500/20"
                  }`}>
                    {priceDifference > 0 ? (
                      <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-medium ${priceDifference > 0 ? "text-orange-700" : "text-green-700"}`}>
                        {priceDifference > 0 
                          ? `Your current price is $${Math.abs(priceDifference).toFixed(2)} below the suggested price`
                          : `Your current price is $${Math.abs(priceDifference).toFixed(2)} above the suggested price`
                        }
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {priceDifference > 0 
                          ? "Consider raising your price to meet your target margin, or accept lower profitability."
                          : "Great! You have room to lower prices for competitiveness or maintain higher margins."
                        }
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || updatePricingMutation.isPending}
                    data-testid="button-save-settings"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save Settings
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleApplySuggestedPrice}
                    disabled={updatePricingMutation.isPending}
                    data-testid="button-apply-price"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Apply Suggested Price (${suggestedPrice.toFixed(2)})
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                All Recipes Overview
                {flaggedRecipesCount > 0 && (
                  <Badge className="bg-red-500/20 text-red-700 border-red-500/30 ml-2">
                    {flaggedRecipesCount} flagged
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Compare pricing metrics across all your recipes. Items below {minimumMarginThreshold}% margin are flagged.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search recipes by name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-recipe-search"
                />
              </div>
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recipesWithMetrics.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No recipes found. Create some recipes first to see pricing analysis.
            </p>
          ) : filteredRecipes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No recipes match your search. Try a different search term.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Recipe</th>
                    <th className="text-right p-3 font-medium">Base Cost</th>
                    <th className="text-right p-3 font-medium">Waste %</th>
                    <th className="text-right p-3 font-medium">True Cost</th>
                    <th className="text-right p-3 font-medium">Menu Price</th>
                    <th className="text-right p-3 font-medium">Margin</th>
                    <th className="text-right p-3 font-medium">Suggested</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.map((recipe) => {
                    const isSelected = recipe.id === selectedRecipeId;

                    return (
                      <tr 
                        key={recipe.id} 
                        className={`border-b hover-elevate cursor-pointer transition-colors ${
                          recipe.isBelowMinMargin 
                            ? "bg-red-500/5" 
                            : isSelected 
                              ? "bg-primary/5" 
                              : ""
                        }`}
                        onClick={() => handleRecipeSelect(recipe.id)}
                        data-testid={`row-recipe-${recipe.id}`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {recipe.isBelowMinMargin && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Margin below {minimumMarginThreshold}% threshold</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <div>
                              <div className="font-medium">{recipe.name}</div>
                              <div className="text-xs text-muted-foreground">{recipe.category}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right tabular-nums">${recipe.costPerServing.toFixed(2)}</td>
                        <td className="p-3 text-right tabular-nums">{recipe.wastePercentage ?? 0}%</td>
                        <td className="p-3 text-right tabular-nums">${recipe.trueCost.toFixed(2)}</td>
                        <td className="p-3 text-right tabular-nums">
                          {(recipe.menuPrice ?? 0) > 0 ? `$${(recipe.menuPrice ?? 0).toFixed(2)}` : "-"}
                        </td>
                        <td className={`p-3 text-right tabular-nums ${
                          (recipe.menuPrice ?? 0) > 0 ? (
                            recipe.isBelowMinMargin 
                              ? "text-red-600 font-medium" 
                              : recipe.isOnTarget 
                                ? "text-green-600" 
                                : "text-orange-600"
                          ) : "text-muted-foreground"
                        }`}>
                          {(recipe.menuPrice ?? 0) > 0 ? `${recipe.margin.toFixed(1)}%` : "-"}
                        </td>
                        <td className="p-3 text-right tabular-nums text-primary font-medium">
                          ${recipe.suggestedPrice.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          {(recipe.menuPrice ?? 0) === 0 ? (
                            <Badge variant="outline">Not priced</Badge>
                          ) : recipe.isBelowMinMargin ? (
                            <Badge className="bg-red-500/20 text-red-700 border-red-500/30">Below {minimumMarginThreshold}%</Badge>
                          ) : recipe.isOnTarget ? (
                            <Badge className="bg-green-500/20 text-green-700 border-green-500/30">On target</Badge>
                          ) : (
                            <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30">Review</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
