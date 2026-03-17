import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ShoppingCart, 
  Download, 
  Store, 
  Package,
  AlertTriangle,
  Check,
  Loader2,
  TrendingDown,
  Sparkles,
  ExternalLink,
  Bot,
  ShoppingBag,
  Zap,
  RefreshCw,
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
import { apiRequest } from "@/lib/queryClient";
import type { Ingredient } from "@shared/schema";

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

interface AutonomousOrderItem {
  id: string;
  name: string;
  searchTerm: string;
  suggestedForm: string;
  quantity: number;
  unit: string;
  category: string;
  searchUrl: string;
  estimatedCost: number;
}

interface AutonomousOrderResponse {
  vendor: string;
  vendorKey: string;
  cartNote?: string;
  items: AutonomousOrderItem[];
  totalItems: number;
}

const VENDORS = [
  { key: "heb", name: "H-E-B", description: "Texas's own grocery chain", badge: "Most Popular" },
  { key: "heb_instacart", name: "H-E-B via Instacart", description: "H-E-B products with delivery", badge: "Delivery" },
  { key: "central_market", name: "Central Market", description: "H-E-B's specialty store", badge: null },
  { key: "sprouts", name: "Sprouts Farmers Market", description: "Natural & organic focus", badge: null },
  { key: "walmart", name: "Walmart Grocery", description: "Competitive bulk pricing", badge: null },
  { key: "whole_foods", name: "Whole Foods Market", description: "Premium & organic products", badge: null },
  { key: "amazon_fresh", name: "Amazon Fresh", description: "Fast same-day delivery", badge: "Fast" },
  { key: "costco", name: "Costco", description: "Bulk restaurant-size packs", badge: "Bulk" },
  { key: "target", name: "Target", description: "Everyday essentials", badge: null },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function calculateEstimatedCost(item: OrderSuggestion): number {
  const unitsNeeded = item.orderQuantity / item.purchaseQuantity;
  return Math.ceil(unitsNeeded) * item.purchaseCost;
}

function VendorCard({ vendor, selected, onSelect }: { 
  vendor: typeof VENDORS[0]; 
  selected: boolean; 
  onSelect: () => void; 
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`vendor-${vendor.key}`}
      className={`w-full text-left p-4 rounded-md border transition-all hover-elevate cursor-pointer ${
        selected 
          ? "border-primary bg-primary/5 ring-1 ring-primary" 
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{vendor.name}</span>
            {vendor.badge && (
              <Badge variant="secondary" className="text-xs">{vendor.badge}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{vendor.description}</p>
        </div>
        {selected && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
      </div>
    </button>
  );
}

function AutoOrderItemRow({ item, index }: { item: AutonomousOrderItem; index: number }) {
  return (
    <div
      className="flex items-center gap-4 p-3 rounded-md border border-border bg-card hover-elevate group"
      data-testid={`auto-order-item-${item.id || index}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{item.name}</span>
          <Badge variant="outline" className="text-xs">{item.category}</Badge>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">Search: </span>
          <span className="text-xs font-medium text-primary">{item.searchTerm}</span>
          <span className="text-xs text-muted-foreground">· {item.suggestedForm}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold">{formatCurrency(item.estimatedCost)}</div>
        <div className="text-xs text-muted-foreground">{item.quantity.toFixed(1)} {item.unit}</div>
      </div>
      <a
        href={item.searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`link-order-item-${item.id || index}`}
      >
        <Button size="icon" variant="ghost" className="shrink-0">
          <ExternalLink className="h-4 w-4" />
        </Button>
      </a>
    </div>
  );
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
      <TableCell className="text-right">{item.currentStock?.toFixed(1) ?? "N/A"}</TableCell>
      <TableCell className="text-right">{item.parValue?.toFixed(1) ?? "N/A"}</TableCell>
      <TableCell className="text-right font-medium text-amber-600 dark:text-amber-400">
        {item.orderQuantity.toFixed(1)} {item.purchaseUnit}
      </TableCell>
      <TableCell className="text-right">
        {unitsToOrder} × {formatCurrency(item.purchaseCost)}
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
  const selectedInStore = items.filter(i => selectedItems.has(i.id));
  const totalCost = selectedInStore.reduce((sum, item) => sum + calculateEstimatedCost(item), 0);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => onToggleAll(store, !!checked)}
              data-testid={`checkbox-store-${store}`}
            />
            <Store className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{store}</CardTitle>
            <Badge variant="secondary">{items.length} items</Badge>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Selected Total</div>
            <div className="text-base font-bold">{formatCurrency(totalCost)}</div>
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

function AutonomousOrderTab({ orderData }: { orderData: OrderSuggestionsResponse | undefined }) {
  const { toast } = useToast();
  const [selectedVendor, setSelectedVendor] = useState("heb_instacart");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [orderResult, setOrderResult] = useState<AutonomousOrderResponse | null>(null);

  const items = orderData?.items || [];

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedItemIds(new Set(items.map(i => i.id)));
  const deselectAll = () => setSelectedItemIds(new Set());

  const autonomousMutation = useMutation({
    mutationFn: async () => {
      const selectedItems = items
        .filter(i => selectedItemIds.has(i.id))
        .map(i => ({
          id: i.id,
          name: i.name,
          quantity: i.orderQuantity,
          unit: i.purchaseUnit,
          category: i.category,
          estimatedCost: calculateEstimatedCost(i),
        }));

      const res = await apiRequest("POST", "/api/inventory/autonomous-order", { items: selectedItems, vendor: selectedVendor });
      return res.json() as Promise<AutonomousOrderResponse>;
    },
    onSuccess: (data) => {
      setOrderResult(data);
      toast({
        title: "Order Ready",
        description: `${data.items.length} items optimized for ${data.vendor}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Order Generation Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const openAllLinks = () => {
    if (!orderResult) return;
    orderResult.items.slice(0, 10).forEach((item, i) => {
      setTimeout(() => window.open(item.searchUrl, "_blank"), i * 300);
    });
    if (orderResult.items.length > 10) {
      toast({
        title: "Opening first 10 items",
        description: "Open remaining items individually using their links.",
      });
    }
  };

  const totalEstimated = useMemo(() => {
    return items
      .filter(i => selectedItemIds.has(i.id))
      .reduce((sum, i) => sum + calculateEstimatedCost(i), 0);
  }, [items, selectedItemIds]);

  if (!orderData || items.length === 0) {
    return (
      <div className="text-center py-16">
        <Bot className="h-14 w-14 text-muted-foreground/40 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-1">No Items to Order</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          All stock levels are at or above par. Autonomous ordering will activate when items fall below their par counts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-semibold">Select Items to Order</h3>
              <p className="text-sm text-muted-foreground">{selectedItemIds.size} of {items.length} items selected</p>
            </div>
            <div className="flex gap-2">
              {selectedItemIds.size > 0 ? (
                <Button variant="outline" size="sm" onClick={deselectAll} data-testid="button-auto-deselect-all">
                  Deselect All
                </Button>
              ) : null}
              {selectedItemIds.size < items.length && (
                <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-auto-select-all">
                  <Check className="h-3 w-3 mr-1" />
                  Select All
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {items.map(item => {
              const isSelected = selectedItemIds.has(item.id);
              const cost = calculateEstimatedCost(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-md border transition-all hover-elevate ${
                    isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                  data-testid={`auto-item-${item.id}`}
                >
                  <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                  }`}>
                    {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.name}</span>
                      <Badge variant="outline" className="text-xs">{item.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Need {item.orderQuantity.toFixed(1)} {item.purchaseUnit}
                      {item.store ? ` · Usually from ${item.store}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0">{formatCurrency(cost)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-3">Choose Vendor</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {VENDORS.map(vendor => (
                <VendorCard
                  key={vendor.key}
                  vendor={vendor}
                  selected={selectedVendor === vendor.key}
                  onSelect={() => setSelectedVendor(vendor.key)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">AI-Powered Product Matching</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI will optimize ingredient names for grocery search • {selectedItemIds.size} items · {formatCurrency(totalEstimated)} estimated
            </p>
          </div>
          <Button
            onClick={() => autonomousMutation.mutate()}
            disabled={selectedItemIds.size === 0 || autonomousMutation.isPending}
            data-testid="button-generate-auto-order"
            className="gap-2"
          >
            {autonomousMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
            {autonomousMutation.isPending ? "Generating..." : "Generate Smart Order"}
          </Button>
        </div>
      </div>

      {orderResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{orderResult.vendor} Order Ready</CardTitle>
                  <CardDescription>{orderResult.items.length} items · {orderResult.cartNote}</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOrderResult(null)}
                  data-testid="button-reset-order"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={openAllLinks}
                  data-testid="button-open-all-links"
                  className="gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open All in {orderResult.vendor}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {orderResult.items.map((item, i) => (
                <AutoOrderItemRow key={item.id || i} item={item} index={i} />
              ))}
            </div>
            <div className="mt-4 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
              <strong>Note:</strong> Each link opens a search for that specific product in {orderResult.vendor}.
              Review and add items to your cart individually, or use bulk ordering if available.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"byStore" | "all" | "auto">("byStore");

  const { data: orderData, isLoading, error } = useQuery<OrderSuggestionsResponse>({
    queryKey: ["/api/inventory/order-suggestions"],
  });

  const { data: ingredients = [] } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStoreItems = (store: string, selected: boolean) => {
    if (!orderData) return;
    const storeItems = orderData.byStore[store] || [];
    setSelectedItems(prev => {
      const next = new Set(prev);
      storeItems.forEach(item => selected ? next.add(item.id) : next.delete(item.id));
      return next;
    });
  };

  const selectAll = () => {
    if (!orderData) return;
    setSelectedItems(new Set(orderData.items.map(i => i.id)));
  };

  const deselectAll = () => setSelectedItems(new Set());

  const selectedTotal = useMemo(() => {
    if (!orderData) return 0;
    return orderData.items
      .filter(item => selectedItems.has(item.id))
      .reduce((sum, item) => sum + calculateEstimatedCost(item), 0);
  }, [orderData, selectedItems]);

  const handleExportCSV = () => {
    if (!orderData || selectedItems.size === 0) {
      toast({ title: "No Items Selected", description: "Please select items to export.", variant: "destructive" });
      return;
    }

    const selectedData = orderData.items.filter(item => selectedItems.has(item.id));
    const headers = ["Item", "Category", "Store", "Current Stock", "Par Value", "Order Qty", "Unit", "Est. Cost"];
    const rows = selectedData.map(item => [
      item.name, item.category, item.store || "Unspecified",
      item.currentStock?.toFixed(1) ?? "N/A",
      item.parValue?.toFixed(1) ?? "N/A",
      item.orderQuantity.toFixed(1), item.purchaseUnit,
      formatCurrency(calculateEstimatedCost(item)),
    ]);

    const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `order-list-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "Order List Exported", description: `Exported ${selectedData.length} items to CSV.` });
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
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Order Generator</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Smart ordering based on par counts — manual or autonomous with local vendors
          </p>
        </div>
        {activeTab !== "auto" && (
          <div className="flex gap-2">
            {selectedItems.size > 0 && (
              <Button variant="outline" onClick={deselectAll} data-testid="button-deselect-all">
                Deselect All
              </Button>
            )}
            {orderData && orderData.totalItems > 0 && selectedItems.size < orderData.totalItems && (
              <Button variant="outline" onClick={selectAll} data-testid="button-select-all">
                <Check className="h-4 w-4 mr-1" />
                Select All
              </Button>
            )}
            <Button onClick={handleExportCSV} disabled={selectedItems.size === 0} data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-1" />
              Export CSV ({selectedItems.size})
            </Button>
          </div>
        )}
      </div>

      {ingredientsWithoutPar.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm">
                <strong>{ingredientsWithoutPar.length}</strong> ingredients have no par values set.
                Set par values in Ingredients to include them in orders.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Items Below Par</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{orderData?.totalItems ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Vendors</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{orderData ? Object.keys(orderData.byStore).length : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Selected</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{selectedItems.size}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Selected Total</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-primary">{formatCurrency(selectedTotal)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="byStore" data-testid="tab-by-store">
            <Store className="h-4 w-4 mr-1.5" />
            By Vendor
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all-items">
            <TrendingDown className="h-4 w-4 mr-1.5" />
            All Items
          </TabsTrigger>
          <TabsTrigger value="auto" data-testid="tab-auto-order">
            <Zap className="h-4 w-4 mr-1.5" />
            Auto-Order
            <Badge variant="secondary" className="ml-1.5 text-xs">AI</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="byStore" className="mt-4">
          {hasNoData ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Orders Needed</h3>
                <p className="text-muted-foreground max-w-md mx-auto text-sm">
                  All items are at or above their par values. Check back after updating inventory counts.
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(orderData?.byStore || {}).map(([store, items]) => (
              <StoreOrderCard
                key={store}
                store={store}
                items={items}
                selectedItems={selectedItems}
                onToggleItem={toggleItem}
                onToggleAll={toggleStoreItems}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {hasNoData ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Orders Needed</h3>
                <p className="text-muted-foreground max-w-md mx-auto text-sm">
                  All items are at or above their par values.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>All Items Needing Reorder</CardTitle>
                <CardDescription>All ingredients below their par value</CardDescription>
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
                        <TableCell className="text-right">{item.currentStock?.toFixed(1) ?? "N/A"}</TableCell>
                        <TableCell className="text-right">{item.parValue?.toFixed(1) ?? "N/A"}</TableCell>
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
          )}
        </TabsContent>

        <TabsContent value="auto" className="mt-4">
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Autonomous Ordering</CardTitle>
                  <CardDescription>
                    AI optimizes your ingredient names and generates direct shopping links for Texas vendors
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <AutonomousOrderTab orderData={orderData} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
