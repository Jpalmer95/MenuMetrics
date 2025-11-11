import { Package, ChefHat, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Ingredient, Recipe } from "@shared/schema";

interface DashboardStatsProps {
  ingredients: Ingredient[];
  recipes: Recipe[];
}

export function DashboardStats({ ingredients, recipes }: DashboardStatsProps) {
  const averageCostPerRecipe =
    recipes.length > 0
      ? recipes.reduce((sum, r) => sum + r.totalCost, 0) / recipes.length
      : 0;

  const totalInventoryValue = ingredients.reduce(
    (sum, ing) => sum + ing.quantity * ing.costPerUnit,
    0
  );

  const stats = [
    {
      title: "Total Ingredients",
      value: ingredients.length.toString(),
      icon: Package,
      description: "In database",
      testId: "stat-total-ingredients",
    },
    {
      title: "Active Recipes",
      value: recipes.length.toString(),
      icon: ChefHat,
      description: "Created",
      testId: "stat-active-recipes",
    },
    {
      title: "Avg Cost/Recipe",
      value: `$${averageCostPerRecipe.toFixed(2)}`,
      icon: DollarSign,
      description: "Per recipe",
      testId: "stat-avg-cost",
    },
    {
      title: "Inventory Value",
      value: `$${totalInventoryValue.toFixed(2)}`,
      icon: TrendingUp,
      description: "Total stock value",
      testId: "stat-inventory-value",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid={stat.testId}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
