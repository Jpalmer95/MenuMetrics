import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertIngredientSchema, type InsertIngredient, type Ingredient, measurementUnits } from "@shared/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

interface IngredientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertIngredient) => void;
  ingredient?: Ingredient;
  isLoading?: boolean;
}

export function IngredientFormDialog({
  open,
  onOpenChange,
  onSubmit,
  ingredient,
  isLoading,
}: IngredientFormDialogProps) {
  const form = useForm<InsertIngredient>({
    resolver: zodResolver(insertIngredientSchema),
    defaultValues: {
      name: "",
      category: "",
      store: "",
      purchaseQuantity: 1,
      purchaseUnit: "units",
      purchaseCost: 0,
    },
  });

  useEffect(() => {
    if (ingredient) {
      form.reset({
        name: ingredient.name,
        category: ingredient.category,
        store: ingredient.store || "",
        purchaseQuantity: ingredient.purchaseQuantity,
        purchaseUnit: ingredient.purchaseUnit,
        purchaseCost: ingredient.purchaseCost,
      });
    } else {
      form.reset({
        name: "",
        category: "",
        store: "",
        purchaseQuantity: 1,
        purchaseUnit: "units",
        purchaseCost: 0,
      });
    }
  }, [ingredient, form]);

  const handleSubmit = (data: InsertIngredient) => {
    onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{ingredient ? "Edit Ingredient" : "Add New Ingredient"}</DialogTitle>
          <DialogDescription>
            {ingredient
              ? "Update the ingredient purchase details. Per-unit costs will be auto-calculated."
              : "Enter what you purchased from the store. Per-unit costs (oz, gram, cup, etc.) will be calculated automatically."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ingredient Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Whole Milk"
                      {...field}
                      data-testid="input-ingredient-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Dairy, Coffee, Pastry"
                      {...field}
                      data-testid="input-ingredient-category"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="store"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Store (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., HEB, Amazon, Costco"
                      {...field}
                      data-testid="input-ingredient-store"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="purchaseQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 32"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        data-testid="input-ingredient-quantity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchaseUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ingredient-unit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {measurementUnits.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="purchaseCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Purchase Cost ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 5.90"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      data-testid="input-ingredient-cost"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                data-testid="button-cancel-ingredient"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} data-testid="button-save-ingredient">
                {isLoading ? "Saving..." : ingredient ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
