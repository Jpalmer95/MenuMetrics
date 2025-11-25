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
  FormDescription,
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
import { useEffect, useState } from "react";
import { Info } from "lucide-react";

// Common ingredient density presets (grams per milliliter)
const DENSITY_PRESETS = [
  { name: "Water", density: 1.0 },
  { name: "Whole Milk", density: 1.03 },
  { name: "All-Purpose Flour", density: 0.5 },
  { name: "Granulated Sugar", density: 0.85 },
  { name: "Brown Sugar", density: 0.72 },
  { name: "Butter", density: 0.91 },
  { name: "Honey", density: 1.42 },
  { name: "Olive Oil", density: 0.92 },
  { name: "Cocoa Powder", density: 0.48 },
  { name: "Salt", density: 1.22 },
] as const;

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
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  
  const form = useForm<InsertIngredient>({
    resolver: zodResolver(insertIngredientSchema),
    defaultValues: {
      name: "",
      category: "",
      store: "",
      purchaseQuantity: 1,
      purchaseUnit: "units",
      purchaseCost: 0,
      pricePerUnit: undefined,
      gramsPerMilliliter: undefined,
      densitySource: undefined,
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
        pricePerUnit: ingredient.pricePerUnit || undefined,
        gramsPerMilliliter: ingredient.gramsPerMilliliter || undefined,
        densitySource: ingredient.densitySource || undefined,
      });
      // Set preset if density matches a known value
      const matchingPreset = DENSITY_PRESETS.find(p => p.density === ingredient.gramsPerMilliliter);
      setSelectedPreset(matchingPreset ? matchingPreset.name : "");
    } else {
      form.reset({
        name: "",
        category: "",
        store: "",
        purchaseQuantity: 1,
        purchaseUnit: "units",
        purchaseCost: 0,
        pricePerUnit: undefined,
        gramsPerMilliliter: undefined,
        densitySource: undefined,
      });
      setSelectedPreset("");
    }
  }, [ingredient, form]);

  const handleSubmit = (data: InsertIngredient) => {
    // Auto-calculate pricePerUnit if unit type is "units"
    if (data.purchaseUnit === "units" && data.purchaseQuantity > 0) {
      data.pricePerUnit = data.purchaseCost / data.purchaseQuantity;
    }
    onSubmit(data);
    form.reset();
    setSelectedPreset("");
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

            {form.watch("purchaseUnit") === "units" && (
              <FormField
                control={form.control}
                name="pricePerUnit"
                render={({ field }) => {
                  const purchaseQuantity = form.watch("purchaseQuantity");
                  const purchaseCost = form.watch("purchaseCost");
                  const autoCalculated = purchaseQuantity > 0 && purchaseCost >= 0 
                    ? (purchaseCost / purchaseQuantity).toFixed(2)
                    : null;
                  
                  return (
                    <FormItem>
                      <FormLabel>Price Per Unit ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={autoCalculated ? `Auto: $${autoCalculated}` : "Will auto-calculate"}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          value={field.value ?? ""}
                          data-testid="input-ingredient-price-per-unit"
                        />
                      </FormControl>
                      <FormDescription>
                        {autoCalculated ? `Auto-calculated: $${autoCalculated}` : ""}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}

            {/* Density Section */}
            <div className="space-y-4 rounded-md border p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Density (Optional)</div>
                  <div className="text-xs text-muted-foreground">
                    Improves accuracy for volume↔weight conversions (e.g., converting cups to ounces).
                    You can leave density blank—costs will be calculated based on available units.
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="gramsPerMilliliter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Density Preset</FormLabel>
                    <Select
                      value={selectedPreset}
                      onValueChange={(value) => {
                        setSelectedPreset(value);
                        if (value === "none") {
                          // User wants to skip density - clear all density fields
                          field.onChange(undefined);
                          form.setValue("densitySource", undefined);
                        } else if (value === "custom") {
                          // User wants to enter manually
                          form.setValue("densitySource", "manual");
                        } else {
                          // Apply preset density
                          const preset = DENSITY_PRESETS.find(p => p.name === value);
                          if (preset) {
                            field.onChange(preset.density);
                            form.setValue("densitySource", "preset");
                          }
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-density-preset">
                          <SelectValue placeholder="Choose a common ingredient or enter manually" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (skip density)</SelectItem>
                        {DENSITY_PRESETS.map((preset) => (
                          <SelectItem key={preset.name} value={preset.name}>
                            {preset.name} ({preset.density} g/mL)
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Custom (enter manually)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(selectedPreset === "custom" || (selectedPreset === "" && form.watch("gramsPerMilliliter"))) && (
                <FormField
                  control={form.control}
                  name="gramsPerMilliliter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Density (grams per milliliter)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 1.0 for water"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value ? parseFloat(e.target.value) : undefined;
                            field.onChange(value);
                            if (value) {
                              form.setValue("densitySource", "manual");
                            }
                          }}
                          data-testid="input-density-manual"
                        />
                      </FormControl>
                      <FormDescription>
                        Reference: Water = 1.0, Milk = 1.03, Flour = 0.5, Sugar = 0.85
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

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
