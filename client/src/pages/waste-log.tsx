import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { 
  Trash2, 
  Plus,
  Calendar,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  X,
  BarChart3
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Ingredient, WasteLogWithIngredient, Employee } from "@shared/schema";
import { wasteReasonLabels, type WasteReason } from "@shared/schema";

const wasteFormSchema = z.object({
  ingredientId: z.string().min(1, "Please select an ingredient"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  reason: z.enum(["expired", "broken", "misordered", "overproduction", "spillage", "other"]),
  notes: z.string().optional(),
  wastedAt: z.string().optional(),
  employeeId: z.string().nullable().optional(),
  employeeName: z.string().optional(),
});

type WasteFormData = z.infer<typeof wasteFormSchema>;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function calculateWasteCost(ingredient: Ingredient, quantity: number): number {
  const costPerUnit = ingredient.purchaseCost / ingredient.purchaseQuantity;
  return costPerUnit * quantity;
}

function getReasonColor(reason: string): string {
  switch (reason) {
    case "expired":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "broken":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "misordered":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "overproduction":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    case "spillage":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  }
}

function WasteLogRow({ 
  log, 
  onDelete 
}: { 
  log: WasteLogWithIngredient;
  onDelete: (id: string) => void;
}) {
  return (
    <TableRow data-testid={`waste-row-${log.id}`}>
      <TableCell className="font-medium">{log.ingredient.name}</TableCell>
      <TableCell>{log.quantity} {log.unit}</TableCell>
      <TableCell>
        <Badge variant="secondary" className={getReasonColor(log.reason)}>
          {wasteReasonLabels[log.reason as WasteReason] || log.reason}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {(log as any).employeeName || "—"}
      </TableCell>
      <TableCell className="text-right font-medium text-destructive">
        {formatCurrency(log.costAtTime)}
      </TableCell>
      <TableCell>{format(new Date(log.wastedAt), "MMM d, yyyy")}</TableCell>
      <TableCell className="max-w-[200px] truncate text-muted-foreground">
        {log.notes || "-"}
      </TableCell>
      <TableCell>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              data-testid={`button-delete-${log.id}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Waste Log Entry</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this waste log entry for {log.ingredient.name}?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(log.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

function AddWasteDialog({ 
  ingredients, 
  onSuccess,
  testId = "button-add-waste"
}: { 
  ingredients: Ingredient[];
  onSuccess: () => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const { toast } = useToast();

  // Fetch employees for business tier (will 403 gracefully for non-business)
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: open,
    retry: false,
  });

  const form = useForm<WasteFormData>({
    resolver: zodResolver(wasteFormSchema),
    defaultValues: {
      ingredientId: "",
      quantity: 0,
      unit: "",
      reason: "expired",
      notes: "",
      wastedAt: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: WasteFormData) => {
      const ingredient = ingredients.find(i => i.id === data.ingredientId);
      if (!ingredient) throw new Error("Ingredient not found");
      
      const costAtTime = calculateWasteCost(ingredient, data.quantity);
      
      return apiRequest("POST", "/api/waste-logs", {
        ...data,
        costAtTime,
        wastedAt: data.wastedAt ? new Date(data.wastedAt).toISOString() : new Date().toISOString(),
        employeeId: data.employeeId || null,
        employeeName: data.employeeName || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste-logs"] });
      setOpen(false);
      form.reset();
      setEstimatedCost(0);
      onSuccess();
      toast({
        title: "Waste Logged",
        description: "The waste entry has been recorded.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log waste",
        variant: "destructive",
      });
    },
  });

  const watchIngredientId = form.watch("ingredientId");
  const watchQuantity = form.watch("quantity");

  const selectedIngredient = useMemo(() => {
    return ingredients.find(i => i.id === watchIngredientId);
  }, [ingredients, watchIngredientId]);

  useMemo(() => {
    if (selectedIngredient && watchQuantity > 0) {
      const cost = calculateWasteCost(selectedIngredient, watchQuantity);
      setEstimatedCost(cost);
    } else {
      setEstimatedCost(0);
    }
  }, [selectedIngredient, watchQuantity]);

  const handleIngredientChange = (ingredientId: string) => {
    const ingredient = ingredients.find(i => i.id === ingredientId);
    if (ingredient) {
      form.setValue("ingredientId", ingredientId);
      form.setValue("unit", ingredient.purchaseUnit);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid={testId}>
          <Plus className="h-4 w-4 mr-2" />
          Log Waste
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Waste</DialogTitle>
          <DialogDescription>
            Record wasted ingredients to track and analyze waste patterns.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="ingredientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ingredient</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={handleIngredientChange}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-ingredient">
                        <SelectValue placeholder="Select ingredient" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ingredients.map((ing) => (
                        <SelectItem key={ing.id} value={ing.id}>
                          {ing.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        {...field}
                        data-testid="input-quantity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly className="bg-muted" data-testid="input-unit" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-reason">
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(wasteReasonLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
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
              name="wastedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional details..."
                      className="resize-none"
                      {...field}
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {employees.length > 0 && (
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logged By (Optional)</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={(val) => {
                        const emp = employees.find(e => e.id === val);
                        field.onChange(val || null);
                        form.setValue("employeeName", emp?.name || undefined);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-employee">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {employees.filter(e => e.isActive).map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}{emp.role ? ` (${emp.role})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {estimatedCost > 0 && (
              <Card className="bg-destructive/5 border-destructive/20">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Estimated Cost:</span>
                    <span className="text-lg font-bold text-destructive">
                      {formatCurrency(estimatedCost)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-waste"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Log Waste
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function WasteLogPage() {
  const { toast } = useToast();

  const { data: wasteLogs = [], isLoading: logsLoading } = useQuery<WasteLogWithIngredient[]>({
    queryKey: ["/api/waste-logs"],
  });

  const { data: ingredients = [], isLoading: ingredientsLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/waste-logs/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste-logs"] });
      toast({
        title: "Entry Deleted",
        description: "The waste log entry has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the waste log entry.",
        variant: "destructive",
      });
    },
  });

  const stats = useMemo(() => {
    const totalCost = wasteLogs.reduce((sum, log) => sum + log.costAtTime, 0);
    const byReason: Record<string, number> = {};
    
    wasteLogs.forEach(log => {
      byReason[log.reason] = (byReason[log.reason] || 0) + log.costAtTime;
    });

    const topReason = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0];
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentLogs = wasteLogs.filter(log => new Date(log.wastedAt) >= thirtyDaysAgo);
    const monthlyTotal = recentLogs.reduce((sum, log) => sum + log.costAtTime, 0);

    return {
      totalCost,
      totalEntries: wasteLogs.length,
      topReason: topReason ? { reason: topReason[0], cost: topReason[1] } : null,
      monthlyTotal,
    };
  }, [wasteLogs]);

  const isLoading = logsLoading || ingredientsLoading;

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
            <Trash2 className="h-8 w-8 text-primary" />
            Waste Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and analyze ingredient waste to reduce costs
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/waste-analytics">
            <Button variant="outline" data-testid="link-waste-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
          </Link>
          <AddWasteDialog 
            ingredients={ingredients}
            onSuccess={() => {}}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(stats.monthlyTotal)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              All Time Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Package className="h-4 w-4" />
              Total Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEntries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Top Waste Reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topReason ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={getReasonColor(stats.topReason.reason)}>
                  {wasteReasonLabels[stats.topReason.reason as WasteReason] || stats.topReason.reason}
                </Badge>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">No data</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Waste History</CardTitle>
          <CardDescription>
            Recent waste log entries sorted by date
          </CardDescription>
        </CardHeader>
        <CardContent>
          {wasteLogs.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Waste Logged Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                Start tracking waste to identify cost-saving opportunities and reduce losses.
              </p>
              <AddWasteDialog 
                ingredients={ingredients}
                onSuccess={() => {}}
                testId="button-add-waste-empty"
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Logged By</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wasteLogs.map(log => (
                  <WasteLogRow
                    key={log.id}
                    log={log}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
