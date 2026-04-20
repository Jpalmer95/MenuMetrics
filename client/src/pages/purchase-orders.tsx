import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ShoppingCart, Plus, Trash2, Check, Clock, XCircle, Package,
  Loader2, FileText, Download, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { PurchaseOrder, Ingredient } from "@shared/schema";

interface OrderWithItems extends PurchaseOrder {
  items: Array<{
    id: string;
    ingredientId: string;
    quantity: number;
    unit: string;
    estimatedUnitCost: number | null;
    estimatedTotalCost: number | null;
    ingredient: Ingredient;
  }>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function getStatusBadge(status: string) {
  switch (status) {
    case "draft":
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
    case "submitted":
      return <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />Submitted</Badge>;
    case "received":
      return <Badge variant="default"><Check className="h-3 w-3 mr-1" />Received</Badge>;
    case "canceled":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Canceled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function OrderCard({ order, onStatusChange, onDelete }: {
  order: OrderWithItems;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card data-testid={`order-card-${order.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {order.vendor || "Unspecified Vendor"}
                {getStatusBadge(order.status)}
              </CardTitle>
              <CardDescription>
                {new Date(order.createdAt).toLocaleDateString()} · {order.items?.length || 0} items
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {formatCurrency(order.totalEstimatedCost || 0)}
            </span>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
      </CardHeader>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {order.items && order.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.ingredient?.name || "Unknown"}</TableCell>
                      <TableCell>{item.quantity} {item.unit}</TableCell>
                      <TableCell className="text-right">
                        {item.estimatedTotalCost ? formatCurrency(item.estimatedTotalCost) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No items in this order</p>
            )}
            {order.notes && (
              <p className="text-sm text-muted-foreground mt-3">Note: {order.notes}</p>
            )}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t">
              {order.status === "draft" && (
                <>
                  <Button size="sm" onClick={() => onStatusChange(order.id, "submitted")} data-testid={`button-submit-${order.id}`}>
                    <Check className="h-4 w-4 mr-1" />Mark Submitted
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDelete(order.id)} data-testid={`button-delete-${order.id}`}>
                    <Trash2 className="h-4 w-4 mr-1" />Delete
                  </Button>
                </>
              )}
              {order.status === "submitted" && (
                <Button size="sm" onClick={() => onStatusChange(order.id, "received")} data-testid={`button-receive-${order.id}`}>
                  <Package className="h-4 w-4 mr-1" />Mark Received
                </Button>
              )}
              {(order.status === "draft" || order.status === "submitted") && (
                <Button size="sm" variant="ghost" onClick={() => onStatusChange(order.id, "canceled")}>
                  Cancel Order
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function GenerateFromLowStockDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");

  const { data: lowStockItems = [] } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
    select: (ingredients) =>
      ingredients.filter(
        i => i.parValue !== null && i.currentStock !== null && i.currentStock < i.parValue
      ),
    enabled: open,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/purchase-orders/generate-from-low-stock", {
        vendor: vendor || null,
        notes: notes || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Purchase order generated from low stock items" });
      onOpenChange(false);
      setVendor("");
      setNotes("");
    },
    onError: () => {
      toast({ title: "Failed to generate order", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Order from Low Stock</DialogTitle>
          <DialogDescription>
            Create a purchase order automatically from items below their par level
          </DialogDescription>
        </DialogHeader>
        {lowStockItems.length === 0 ? (
          <div className="py-8 text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="font-medium">All items are at or above par level</p>
            <p className="text-sm text-muted-foreground">No order needed right now</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">{lowStockItems.length} items below par:</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">
                      {item.currentStock} / {item.parValue} {item.purchaseUnit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Vendor (optional)</label>
              <Input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g., Costco, Sysco"
                className="mt-1"
                data-testid="input-order-vendor"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions"
                className="mt-1"
                data-testid="textarea-order-notes"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-order"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Purchase Order
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PurchaseOrdersPage() {
  const { toast } = useToast();
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);

  const { data: orders = [], isLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/purchase-orders/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Order status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update order", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/purchase-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Order deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete order", variant: "destructive" });
    },
  });

  const draftOrders = orders.filter(o => o.status === "draft");
  const activeOrders = orders.filter(o => o.status === "submitted");
  const completedOrders = orders.filter(o => o.status === "received" || o.status === "canceled");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-purchase-orders">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Purchase Orders
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your ordering workflow — generate orders from low stock items
          </p>
        </div>
        <Button onClick={() => setGenerateDialogOpen(true)} data-testid="button-generate-from-low-stock">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate from Low Stock
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg">No purchase orders yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Generate an order from your low stock items to get started
            </p>
            <Button onClick={() => setGenerateDialogOpen(true)} className="mt-4">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate from Low Stock
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {draftOrders.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Draft Orders ({draftOrders.length})
              </h2>
              <div className="space-y-3">
                {draftOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeOrders.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Active Orders ({activeOrders.length})
              </h2>
              <div className="space-y-3">
                {activeOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}

          {completedOrders.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4" />
                Completed ({completedOrders.length})
              </h2>
              <div className="space-y-3 opacity-75">
                {completedOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <GenerateFromLowStockDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
      />
    </div>
  );
}
