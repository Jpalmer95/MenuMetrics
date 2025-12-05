import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Package, 
  Snowflake, 
  Thermometer, 
  Box, 
  Search, 
  Save, 
  Check,
  X,
  ClipboardList,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Ingredient, StorageType } from "@shared/schema";
import { storageTypeLabels } from "@shared/schema";

interface StockUpdate {
  ingredientId: string;
  currentStock: number;
}

function StorageIcon({ type }: { type: string }) {
  switch (type) {
    case "cold":
      return <Thermometer className="h-4 w-4" />;
    case "frozen":
      return <Snowflake className="h-4 w-4" />;
    case "supplies":
      return <Box className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
}

function IngredientCountRow({ 
  ingredient, 
  pendingStock, 
  onStockChange 
}: { 
  ingredient: Ingredient;
  pendingStock: number | undefined;
  onStockChange: (id: string, stock: number) => void;
}) {
  const currentValue = pendingStock !== undefined ? pendingStock : (ingredient.currentStock ?? 0);
  const hasChanged = pendingStock !== undefined && pendingStock !== (ingredient.currentStock ?? 0);
  
  const needsReorder = ingredient.parValue !== null && 
    currentValue < ingredient.parValue;

  return (
    <div 
      className={`flex items-center justify-between p-3 border rounded-md hover-elevate ${
        needsReorder ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" : ""
      }`}
      data-testid={`inventory-row-${ingredient.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{ingredient.name}</span>
          {hasChanged && (
            <Badge variant="secondary" className="text-xs">
              Modified
            </Badge>
          )}
          {needsReorder && (
            <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-400">
              Low Stock
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="truncate">{ingredient.category}</span>
          {ingredient.parValue !== null && (
            <span className="text-xs">Par: {ingredient.parValue} {ingredient.purchaseUnit}</span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 ml-4">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onStockChange(ingredient.id, Math.max(0, currentValue - 1))}
            data-testid={`button-decrease-${ingredient.id}`}
          >
            <span className="text-lg font-bold">-</span>
          </Button>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={currentValue}
            onChange={(e) => onStockChange(ingredient.id, parseFloat(e.target.value) || 0)}
            className="w-20 text-center h-8"
            data-testid={`input-stock-${ingredient.id}`}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onStockChange(ingredient.id, currentValue + 1)}
            data-testid={`button-increase-${ingredient.id}`}
          >
            <span className="text-lg font-bold">+</span>
          </Button>
        </div>
        <span className="text-sm text-muted-foreground min-w-[60px]">
          {ingredient.purchaseUnit}
        </span>
      </div>
    </div>
  );
}

export default function InventoryCountPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, number>>({});

  const { data: ingredients = [], isLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const recordCountMutation = useMutation({
    mutationFn: async (data: { storageType?: string; itemsCounted: number; notes?: string }) => {
      const response = await apiRequest("POST", "/api/inventory/count", data);
      return response.json();
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: StockUpdate[]) => {
      const response = await apiRequest("POST", "/api/inventory/bulk-update", { updates });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      
      recordCountMutation.mutate({
        storageType: activeTab === "all" ? undefined : activeTab,
        itemsCounted: variables.length,
      });
      
      setPendingUpdates({});
      toast({
        title: "Count Saved",
        description: data.message || `Successfully updated ${data.updated} items.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save inventory count",
        variant: "destructive",
      });
    },
  });

  const handleStockChange = (ingredientId: string, stock: number) => {
    setPendingUpdates(prev => ({
      ...prev,
      [ingredientId]: stock,
    }));
  };

  const handleSaveAll = () => {
    const updates: StockUpdate[] = Object.entries(pendingUpdates).map(([ingredientId, currentStock]) => ({
      ingredientId,
      currentStock,
    }));

    if (updates.length === 0) {
      toast({
        title: "No Changes",
        description: "No inventory changes to save.",
      });
      return;
    }

    bulkUpdateMutation.mutate(updates);
  };

  const handleDiscardChanges = () => {
    setPendingUpdates({});
    toast({
      title: "Changes Discarded",
      description: "All pending changes have been discarded.",
    });
  };

  const filteredIngredients = useMemo(() => {
    let filtered = ingredients;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(ing => 
        ing.name.toLowerCase().includes(term) ||
        ing.category.toLowerCase().includes(term)
      );
    }

    if (activeTab !== "all") {
      filtered = filtered.filter(ing => ing.storageType === activeTab);
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, searchTerm, activeTab]);

  const ingredientsByStorage = useMemo(() => {
    const groups: Record<string, Ingredient[]> = {
      dry: [],
      cold: [],
      frozen: [],
      supplies: [],
      unassigned: [],
    };

    ingredients.forEach(ing => {
      const type = ing.storageType || "unassigned";
      if (groups[type]) {
        groups[type].push(ing);
      } else {
        groups.unassigned.push(ing);
      }
    });

    return groups;
  }, [ingredients]);

  const pendingCount = Object.keys(pendingUpdates).length;
  const lowStockCount = filteredIngredients.filter(ing => 
    ing.parValue !== null && 
    (pendingUpdates[ing.id] !== undefined ? pendingUpdates[ing.id] : (ing.currentStock ?? 0)) < ing.parValue
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-8 w-8 text-primary" />
            Inventory Count
          </h1>
          <p className="text-muted-foreground mt-1">
            Quick count your inventory by storage area
          </p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <>
              <Button
                variant="outline"
                onClick={handleDiscardChanges}
                data-testid="button-discard-changes"
              >
                <X className="h-4 w-4 mr-2" />
                Discard ({pendingCount})
              </Button>
              <Button
                onClick={handleSaveAll}
                disabled={bulkUpdateMutation.isPending}
                data-testid="button-save-count"
              >
                {bulkUpdateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Count ({pendingCount})
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ingredients.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
              {lowStockCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Showing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredIngredients.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ingredients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({ingredients.length})
          </TabsTrigger>
          <TabsTrigger value="dry" data-testid="tab-dry">
            <Package className="h-4 w-4 mr-1" />
            Dry ({ingredientsByStorage.dry.length})
          </TabsTrigger>
          <TabsTrigger value="cold" data-testid="tab-cold">
            <Thermometer className="h-4 w-4 mr-1" />
            Cold ({ingredientsByStorage.cold.length})
          </TabsTrigger>
          <TabsTrigger value="frozen" data-testid="tab-frozen">
            <Snowflake className="h-4 w-4 mr-1" />
            Frozen ({ingredientsByStorage.frozen.length})
          </TabsTrigger>
          <TabsTrigger value="supplies" data-testid="tab-supplies">
            <Box className="h-4 w-4 mr-1" />
            Supplies ({ingredientsByStorage.supplies.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StorageIcon type={activeTab} />
                {activeTab === "all" ? "All Items" : storageTypeLabels[activeTab as StorageType] || activeTab}
              </CardTitle>
              <CardDescription>
                {activeTab === "all" 
                  ? "Count all inventory items" 
                  : `Count items in ${storageTypeLabels[activeTab as StorageType] || activeTab}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredIngredients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? (
                    <p>No items match your search.</p>
                  ) : activeTab !== "all" ? (
                    <p>No items assigned to this storage area. Set storage type in the Ingredients page.</p>
                  ) : (
                    <p>No ingredients found. Add some in the Ingredients page first.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredIngredients.map(ingredient => (
                    <IngredientCountRow
                      key={ingredient.id}
                      ingredient={ingredient}
                      pendingStock={pendingUpdates[ingredient.id]}
                      onStockChange={handleStockChange}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {pendingCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Card className="shadow-lg">
            <CardContent className="flex items-center gap-4 py-3 px-4">
              <span className="text-sm font-medium">
                {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDiscardChanges}
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAll}
                disabled={bulkUpdateMutation.isPending}
              >
                {bulkUpdateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Save All
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
