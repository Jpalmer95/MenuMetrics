import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ShoppingCart, 
  Download, 
  Store, 
  Package,
  AlertTriangle,
  Check,
  Loader2,
  TrendingDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { Ingredient } from "@shared/schema";
import { storageTypeLabels, type StorageType } from "@shared/schema";

interface OrderSuggestion {
  id: string;
  name: string;
  category: string;
  store: string | null;
  currentStock: number | null;
  parValue: number | null;
  orderQuantity: number;
  purchaseUnit: string;
  purchaseCost: number;
  purchaseQuantity: number;
  storageType: string | null;
}

interface OrderSuggestionsResponse {
  items: OrderSuggestion[];
  byStore: Record<string, OrderSuggestion[]>;
  totalItems: number;
  summary: Array<{
    store: string;
    itemCount: number;
    estimatedCost: number;
  }>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function calculateEstimatedCost(item: OrderSuggestion): number {
  const unitsNeeded = item.orderQuantity / item.purchaseQuantity;
  return Math.ceil(unitsNeeded) * item.purchaseCost;
}

function OrderItemRow({ 
  item, 
  isSelected, 
  onToggle 
}: { 
  item: OrderSuggestion; 
  isSelected: boolean;
  onToggle: (id: string) => void;
}) {
  const estimatedCost = calculateEstimatedCost(item);
  const unitsToOrder = Math.ceil(item.orderQuantity / item.purchaseQuantity);

  return (
    <TableRow data-testid={`order-row-${item.id}`}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle(item.id)}
          data-testid={`checkbox-${item.id}`}
        />
      </TableCell>
      <TableCell className="font-medium">{item.name}</TableCell>
      <TableCell>{item.category}</TableCell>
      <TableCell className="text-right">
        {item.currentStock?.toFixed(1) ?? "N/A"}
      </TableCell>
      <TableCell className="text-right">
        {item.parValue?.toFixed(1) ?? "N/A"}
      </TableCell>
      <TableCell className="text-right font-medium text-amber-600 dark:text-amber-400">
        {item.orderQuantity.toFixed(1)} {item.purchaseUnit}
      </TableCell>
      <TableCell className="text-right">
        {unitsToOrder} x {formatCurrency(item.purchaseCost)}
      </TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(estimatedCost)}
      </TableCell>
    </TableRow>
  );
}

function StoreOrderCard({ 
  store, 
  items, 
  selectedItems,
  onToggleItem,
  onToggleAll 
}: { 
  store: string; 
  items: OrderSuggestion[];
  selectedItems: Set<string>;
  onToggleItem: (id: string) => void;
  onToggleAll: (store: string, selected: boolean) => void;
}) {
  const storeItemIds = items.map(i => i.id);
  const allSelected = storeItemIds.every(id => selectedItems.has(id));
  const someSelected = storeItemIds.some(id => selectedItems.has(id));
  const selectedInStore = items.filter(i => selectedItems.has(i.id));
  
  const totalCost = selectedInStore.reduce((sum, item) => sum + calculateEstimatedCost(item), 0);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => onToggleAll(store, !!checked)}
              data-testid={`checkbox-store-${store}`}
            />
            <Store className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{store}</CardTitle>
            <Badge variant="secondary">{items.length} items</Badge>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Selected Total</div>
            <div className="text-lg font-bold">{formatCurrency(totalCost)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Par</TableHead>
              <TableHead className="text-right">Need</TableHead>
              <TableHead className="text-right">Purchase</TableHead>
              <TableHead className="text-right">Est. Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <OrderItemRow
                key={item.id}
                item={item}
                isSelected={selectedItems.has(item.id)}
                onToggle={onToggleItem}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function OrdersPage() {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<"byStore" | "all">("byStore");

  const { data: orderData, isLoading, error } = useQuery<OrderSuggestionsResponse>({
    queryKey: ["/api/inventory/order-suggestions"],
  });

  const { data: ingredients = [] } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleStoreItems = (store: string, selected: boolean) => {
    if (!orderData) return;
    
    const storeItems = orderData.byStore[store] || [];
    setSelectedItems(prev => {
      const next = new Set(prev);
      storeItems.forEach(item => {
        if (selected) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      });
      return next;
    });
  };

  const selectAll = () => {
    if (!orderData) return;
    setSelectedItems(new Set(orderData.items.map(i => i.id)));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const selectedTotal = useMemo(() => {
    if (!orderData) return 0;
    return orderData.items
      .filter(item => selectedItems.has(item.id))
      .reduce((sum, item) => sum + calculateEstimatedCost(item), 0);
  }, [orderData, selectedItems]);

  const handleExportExcel = () => {
    if (!orderData || selectedItems.size === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select items to export.",
        variant: "destructive",
      });
      return;
    }

    const selectedData = orderData.items.filter(item => selectedItems.has(item.id));
    
    const headers = ["Item", "Category", "Store", "Current Stock", "Par Value", "Order Qty", "Unit", "Est. Cost"];
    const rows = selectedData.map(item => [
      item.name,
      item.category,
      item.store || "Unspecified",
      item.currentStock?.toFixed(1) ?? "N/A",
      item.parValue?.toFixed(1) ?? "N/A",
      item.orderQuantity.toFixed(1),
      item.purchaseUnit,
      formatCurrency(calculateEstimatedCost(item)),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `order-list-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Order List Exported",
      description: `Exported ${selectedData.length} items to CSV.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-muted-foreground">Failed to load order suggestions.</p>
      </div>
    );
  }

  const hasNoData = !orderData || orderData.totalItems === 0;
  const ingredientsWithoutPar = ingredients.filter(ing => ing.parValue === null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Order Generator
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate order lists based on par values and current stock levels
          </p>
        </div>
        <div className="flex gap-2">
          {selectedItems.size > 0 && (
            <Button
              variant="outline"
              onClick={deselectAll}
              data-testid="button-deselect-all"
            >
              Deselect All
            </Button>
          )}
          {orderData && orderData.totalItems > 0 && selectedItems.size < orderData.totalItems && (
            <Button
              variant="outline"
              onClick={selectAll}
              data-testid="button-select-all"
            >
              <Check className="h-4 w-4 mr-2" />
              Select All
            </Button>
          )}
          <Button
            onClick={handleExportExcel}
            disabled={selectedItems.size === 0}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV ({selectedItems.size})
          </Button>
        </div>
      </div>

      {ingredientsWithoutPar.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">Setup Tip</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              <strong>{ingredientsWithoutPar.length}</strong> ingredients don't have par values set. 
              Set par values in the Ingredients page to include them in order suggestions.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Items Below Par</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {orderData?.totalItems ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orderData ? Object.keys(orderData.byStore).length : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Selected Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedItems.size}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Selected Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(selectedTotal)}
            </div>
          </CardContent>
        </Card>
      </div>

      {hasNoData ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Orders Needed</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              All items are at or above their par values. Check back after updating your inventory counts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "byStore" | "all")}>
            <TabsList>
              <TabsTrigger value="byStore" data-testid="tab-by-store">
                <Store className="h-4 w-4 mr-1" />
                By Store
              </TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all-items">
                <TrendingDown className="h-4 w-4 mr-1" />
                All Items
              </TabsTrigger>
            </TabsList>

            <TabsContent value="byStore" className="mt-4">
              {Object.entries(orderData?.byStore || {}).map(([store, items]) => (
                <StoreOrderCard
                  key={store}
                  store={store}
                  items={items}
                  selectedItems={selectedItems}
                  onToggleItem={toggleItem}
                  onToggleAll={toggleStoreItems}
                />
              ))}
            </TabsContent>

            <TabsContent value="all" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>All Items Needing Reorder</CardTitle>
                  <CardDescription>
                    All ingredients below their par value
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={orderData && selectedItems.size === orderData.totalItems}
                            onCheckedChange={(checked) => checked ? selectAll() : deselectAll()}
                          />
                        </TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">Par</TableHead>
                        <TableHead className="text-right">Need</TableHead>
                        <TableHead className="text-right">Est. Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderData?.items.map(item => (
                        <TableRow key={item.id} data-testid={`all-order-row-${item.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell>{item.store || "Unspecified"}</TableCell>
                          <TableCell className="text-right">
                            {item.currentStock?.toFixed(1) ?? "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.parValue?.toFixed(1) ?? "N/A"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-amber-600">
                            {item.orderQuantity.toFixed(1)} {item.purchaseUnit}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(calculateEstimatedCost(item))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
