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
      quantity: 1,
      unit: "units",
      costPerUnit: 0,
    },
  });

  useEffect(() => {
    if (ingredient) {
      form.reset({
        name: ingredient.name,
        category: ingredient.category,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        costPerUnit: ingredient.costPerUnit,
      });
    } else {
      form.reset({
        name: "",
        category: "",
        quantity: 1,
        unit: "units",
        costPerUnit: 0,
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
              ? "Update the ingredient details below."
              : "Enter the ingredient information to add it to your database."}
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
                        step="0.01"
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
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
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
              name="costPerUnit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost per Unit ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
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
