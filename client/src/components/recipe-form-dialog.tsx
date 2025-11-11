import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRecipeSchema, type InsertRecipe, type Recipe } from "@shared/schema";
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
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

interface RecipeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertRecipe) => void;
  recipe?: Recipe;
  isLoading?: boolean;
}

export function RecipeFormDialog({
  open,
  onOpenChange,
  onSubmit,
  recipe,
  isLoading,
}: RecipeFormDialogProps) {
  const form = useForm<InsertRecipe>({
    resolver: zodResolver(insertRecipeSchema),
    defaultValues: {
      name: "",
      servings: 1,
    },
  });

  useEffect(() => {
    if (recipe) {
      form.reset({
        name: recipe.name,
        servings: recipe.servings,
      });
    } else {
      form.reset({
        name: "",
        servings: 1,
      });
    }
  }, [recipe, form]);

  const handleSubmit = (data: InsertRecipe) => {
    onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{recipe ? "Edit Recipe" : "Create New Recipe"}</DialogTitle>
          <DialogDescription>
            {recipe
              ? "Update the recipe details below."
              : "Enter the recipe information. You'll add ingredients in the next step."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipe Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Caramel Latte"
                      {...field}
                      data-testid="input-recipe-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="servings"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Servings</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      data-testid="input-recipe-servings"
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
                data-testid="button-cancel-recipe"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} data-testid="button-save-recipe">
                {isLoading ? "Saving..." : recipe ? "Update" : "Create & Add Ingredients"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
