import { useQuery } from "@tanstack/react-query";
import { DashboardStats } from "@/components/dashboard-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Ingredient, Recipe } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function DashboardPage() {
  const { data: ingredients = [], isLoading: ingredientsLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const { data: recipes = [], isLoading: recipesLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  if (ingredientsLoading || recipesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const categoryData = ingredients.reduce((acc, ing) => {
    const existing = acc.find((item) => item.name === ing.category);
    if (existing) {
      existing.count += 1;
      existing.value += ing.costPerUnit * ing.quantity;
    } else {
      acc.push({
        name: ing.category,
        count: 1,
        value: ing.costPerUnit * ing.quantity,
      });
    }
    return acc;
  }, [] as Array<{ name: string; count: number; value: number }>);

  const topRecipesByPerUnitCost = [...recipes]
    .map((r) => ({
      ...r,
      costPerServing: r.servings > 0 ? r.totalCost / r.servings : 0,
    }))
    .sort((a, b) => b.costPerServing - a.costPerServing)
    .slice(0, 5)
    .map((r) => ({
      name: r.name.length > 15 ? r.name.substring(0, 15) + "..." : r.name,
      cost: r.costPerServing,
    }));

  const leastExpensiveRecipes = [...recipes]
    .map((r) => ({
      ...r,
      costPerServing: r.servings > 0 ? r.totalCost / r.servings : 0,
    }))
    .sort((a, b) => a.costPerServing - b.costPerServing)
    .slice(0, 5)
    .map((r) => ({
      name: r.name.length > 15 ? r.name.substring(0, 15) + "..." : r.name,
      cost: r.costPerServing,
    }));

  const mostProfitableByDollarAmount = [...recipes]
    .filter((r) => r.menuPrice && r.menuPrice > 0)
    .map((r) => ({
      ...r,
      costPerServing: r.servings > 0 ? r.totalCost / r.servings : 0,
      profitPerUnit: (r.menuPrice || 0) - (r.servings > 0 ? r.totalCost / r.servings : 0),
    }))
    .sort((a, b) => b.profitPerUnit - a.profitPerUnit)
    .slice(0, 5)
    .map((r) => ({
      name: r.name.length > 15 ? r.name.substring(0, 15) + "..." : r.name,
      profit: r.profitPerUnit,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your ingredients, recipes, and cost analysis
        </p>
      </div>

      <DashboardStats ingredients={ingredients} recipes={recipes} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most Expensive Recipes</CardTitle>
            <CardDescription>Highest cost per serving</CardDescription>
          </CardHeader>
          <CardContent>
            {topRecipesByPerUnitCost.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recipes yet. Create your first recipe to see cost analysis.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topRecipesByPerUnitCost}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Cost-Efficient Recipes</CardTitle>
            <CardDescription>Lowest cost per serving</CardDescription>
          </CardHeader>
          <CardContent>
            {leastExpensiveRecipes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recipes yet. Create your first recipe to see cost analysis.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leastExpensiveRecipes}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ingredients by Category</CardTitle>
          <CardDescription>Distribution of your inventory</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No ingredients yet. Add ingredients to see category breakdown.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
