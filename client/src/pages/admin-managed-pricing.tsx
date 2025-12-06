import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Shield, Users, Eye, Calendar, RefreshCw, Package, ChefHat, DollarSign, ArrowLeft, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Ingredient, Recipe } from "@shared/schema";

interface ManagedPricingSubscription {
  id: string;
  userId: string;
  tier: string;
  status: string;
  businessName: string | null;
  contactPhone: string | null;
  specialNotes: string | null;
  lastPriceUpdateAt: string | null;
  nextScheduledUpdate: string | null;
  createdAt: string;
  currentItemCount: number;
  tierDetails: {
    name: string;
    maxItems: number | null;
    priceMonthly: number;
    description: string;
  };
}

interface UserData {
  subscription: ManagedPricingSubscription;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  ingredients: Ingredient[];
  recipes: Recipe[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Not set";
  return format(new Date(dateStr), "MMM d, yyyy");
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "paused":
      return "secondary";
    case "canceled":
      return "destructive";
    default:
      return "outline";
  }
}

export default function AdminManagedPricingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<ManagedPricingSubscription | null>(null);
  const [updateFormData, setUpdateFormData] = useState({
    lastPriceUpdateAt: "",
    nextScheduledUpdate: "",
    status: "",
    specialNotes: "",
  });

  const { data: subscriptions, isLoading: subscriptionsLoading, error: subscriptionsError } = useQuery<ManagedPricingSubscription[]>({
    queryKey: ["/api/admin/managed-pricing"],
  });

  const { data: userData, isLoading: userDataLoading } = useQuery<UserData>({
    queryKey: ["/api/admin/managed-pricing", selectedUserId, "data"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/managed-pricing/${selectedUserId}/data`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user data");
      return res.json();
    },
    enabled: !!selectedUserId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Record<string, any> }) => {
      return await apiRequest("PATCH", `/api/admin/managed-pricing/${userId}`, updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/managed-pricing"] });
      if (selectedUserId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/managed-pricing", selectedUserId, "data"] });
      }
      if (variables.userId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/managed-pricing", variables.userId, "data"] });
      }
      toast({
        title: "Subscription updated",
        description: "Service tracking has been updated successfully.",
      });
      setEditingSubscription(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update subscription.",
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (subscription: ManagedPricingSubscription) => {
    setEditingSubscription(subscription);
    setUpdateFormData({
      lastPriceUpdateAt: subscription.lastPriceUpdateAt ? new Date(subscription.lastPriceUpdateAt).toISOString().split("T")[0] : "",
      nextScheduledUpdate: subscription.nextScheduledUpdate ? new Date(subscription.nextScheduledUpdate).toISOString().split("T")[0] : "",
      status: subscription.status,
      specialNotes: subscription.specialNotes || "",
    });
  };

  const handleUpdateSubmit = () => {
    if (!editingSubscription) return;
    
    const updates: Record<string, any> = {};
    if (updateFormData.lastPriceUpdateAt) {
      updates.lastPriceUpdateAt = updateFormData.lastPriceUpdateAt;
    }
    if (updateFormData.nextScheduledUpdate) {
      updates.nextScheduledUpdate = updateFormData.nextScheduledUpdate;
    }
    if (updateFormData.status && updateFormData.status !== editingSubscription.status) {
      updates.status = updateFormData.status;
    }
    if (updateFormData.specialNotes !== (editingSubscription.specialNotes || "")) {
      updates.specialNotes = updateFormData.specialNotes || null;
    }
    
    updateMutation.mutate({ userId: editingSubscription.userId, updates });
  };

  const markServiceCompleted = (subscription: ManagedPricingSubscription) => {
    const today = new Date().toISOString().split("T")[0];
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split("T")[0];
    
    updateMutation.mutate({
      userId: subscription.userId,
      updates: {
        lastPriceUpdateAt: today,
        nextScheduledUpdate: nextMonthStr,
      },
    });
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
        <Button onClick={() => setLocation("/")} data-testid="button-go-home">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to Dashboard
        </Button>
      </div>
    );
  }

  if (subscriptionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (subscriptionsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Error Loading Data</h1>
        <p className="text-muted-foreground">Failed to load managed pricing subscriptions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Admin: Managed Pricing</h1>
          <p className="text-muted-foreground">View and manage customer pricing subscriptions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-subscribers">
              {subscriptions?.length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-subscriptions">
              {subscriptions?.filter(s => s.status === "active").length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-monthly-revenue">
              {formatCurrency(
                subscriptions
                  ?.filter(s => s.status === "active")
                  .reduce((sum, s) => sum + (s.tierDetails?.priceMonthly || 0), 0) || 0
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Managed Pricing Subscribers</CardTitle>
          <CardDescription>All customers who have subscribed to the managed pricing service</CardDescription>
        </CardHeader>
        <CardContent>
          {!subscriptions || subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No managed pricing subscribers yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Service</TableHead>
                  <TableHead>Next Scheduled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id} data-testid={`row-subscription-${sub.userId}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sub.businessName || "Unnamed Business"}</div>
                        <div className="text-sm text-muted-foreground">{sub.contactPhone || "No phone"}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{sub.tierDetails?.name || sub.tier}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span>{sub.currentItemCount}</span>
                        <span className="text-muted-foreground">
                          / {sub.tierDetails?.maxItems || "∞"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(sub.status)}>
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(sub.lastPriceUpdateAt)}</TableCell>
                    <TableCell>{formatDate(sub.nextScheduledUpdate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedUserId(sub.userId)}
                          data-testid={`button-view-data-${sub.userId}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(sub)}
                          data-testid={`button-edit-${sub.userId}`}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          Update
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => markServiceCompleted(sub)}
                          disabled={updateMutation.isPending}
                          data-testid={`button-complete-${sub.userId}`}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Done
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editingSubscription !== null} onOpenChange={(open) => !open && setEditingSubscription(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Service Tracking</DialogTitle>
            <DialogDescription>
              Update service dates and status for {editingSubscription?.businessName || "this subscription"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lastPriceUpdateAt">Last Service Date</Label>
              <Input
                id="lastPriceUpdateAt"
                type="date"
                value={updateFormData.lastPriceUpdateAt}
                onChange={(e) => setUpdateFormData(prev => ({ ...prev, lastPriceUpdateAt: e.target.value }))}
                data-testid="input-last-service-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nextScheduledUpdate">Next Scheduled Date</Label>
              <Input
                id="nextScheduledUpdate"
                type="date"
                value={updateFormData.nextScheduledUpdate}
                onChange={(e) => setUpdateFormData(prev => ({ ...prev, nextScheduledUpdate: e.target.value }))}
                data-testid="input-next-scheduled-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={updateFormData.status}
                onValueChange={(value) => setUpdateFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="specialNotes">Notes</Label>
              <Textarea
                id="specialNotes"
                value={updateFormData.specialNotes}
                onChange={(e) => setUpdateFormData(prev => ({ ...prev, specialNotes: e.target.value }))}
                placeholder="Any special notes about this customer..."
                data-testid="input-special-notes"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingSubscription(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleUpdateSubmit} disabled={updateMutation.isPending} data-testid="button-save-update">
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedUserId !== null} onOpenChange={(open) => !open && setSelectedUserId(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Data</DialogTitle>
            <DialogDescription>
              {userData?.user?.firstName} {userData?.user?.lastName} - {userData?.user?.email}
            </DialogDescription>
          </DialogHeader>
          
          {userDataLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : userData ? (
            <Tabs defaultValue="ingredients">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ingredients" data-testid="tab-ingredients">
                  <Package className="h-4 w-4 mr-2" />
                  Ingredients ({userData.ingredients.length})
                </TabsTrigger>
                <TabsTrigger value="recipes" data-testid="tab-recipes">
                  <ChefHat className="h-4 w-4 mr-2" />
                  Recipes ({userData.recipes.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="ingredients" className="mt-4">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead>Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userData.ingredients.map((ing) => (
                        <TableRow key={ing.id} data-testid={`row-ingredient-${ing.id}`}>
                          <TableCell className="font-medium">{ing.name}</TableCell>
                          <TableCell>{ing.category}</TableCell>
                          <TableCell>{ing.store || "-"}</TableCell>
                          <TableCell className="text-right">${ing.purchaseCost.toFixed(2)}</TableCell>
                          <TableCell>{ing.purchaseQuantity} {ing.purchaseUnit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              
              <TabsContent value="recipes" className="mt-4">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Menu Price</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead>Servings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userData.recipes.map((recipe) => (
                        <TableRow key={recipe.id} data-testid={`row-recipe-${recipe.id}`}>
                          <TableCell className="font-medium">{recipe.name}</TableCell>
                          <TableCell>{recipe.category}</TableCell>
                          <TableCell className="text-right">
                            {recipe.menuPrice ? `$${recipe.menuPrice.toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {recipe.totalCost ? `$${recipe.totalCost.toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell>{recipe.servings}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-muted-foreground text-center py-8">No data available</p>
          )}
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSelectedUserId(null)} data-testid="button-close-data">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
