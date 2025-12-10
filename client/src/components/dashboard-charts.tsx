import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, GripVertical, Maximize2, Minimize2 } from "lucide-react";
import type { Ingredient, Recipe, DashboardChartType, DashboardConfig, WasteLog } from "@shared/schema";
import { dashboardChartLabels } from "@shared/schema";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
} from "recharts";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface ChartWidgetProps {
  config: DashboardConfig;
  ingredients: Ingredient[];
  recipes: Recipe[];
  wasteLogs?: WasteLog[];
  onRemove?: (id: string) => void;
  onToggleWidth?: (id: string) => void;
  isOver?: boolean;
}

export function SortableChartWidget(props: ChartWidgetProps & { isOver?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.config.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${props.config.width === "full" ? "md:col-span-2" : ""} ${isDragging ? "opacity-40" : ""}`}
      data-testid={`sortable-chart-${props.config.id}`}
    >
      <ChartWidget 
        {...props} 
        dragHandleProps={{ attributes, listeners }} 
        isDragging={isDragging}
        isOver={props.isOver}
      />
    </div>
  );
}

interface DragHandleProps {
  attributes?: Record<string, unknown>;
  listeners?: Record<string, unknown>;
}

export function ChartWidget({
  config,
  ingredients,
  recipes,
  wasteLogs = [],
  onRemove,
  onToggleWidth,
  dragHandleProps,
  isDragging,
  isOver,
}: ChartWidgetProps & { dragHandleProps?: DragHandleProps; isDragging?: boolean; isOver?: boolean }) {
  const chartInfo = dashboardChartLabels[config.chartType as DashboardChartType] || {
    name: "Unknown Chart",
    description: "",
  };

  const chartHeight = config.width === "full" ? 350 : 300;

  return (
    <Card
      className={`relative transition-all duration-200 ${
        isDragging ? "shadow-2xl ring-2 ring-primary scale-105" : ""
      } ${
        isOver ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5" : ""
      }`}
      data-testid={`chart-widget-${config.id}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-1 sm:gap-2 pb-1 sm:pb-2 px-2 sm:px-6 pt-2 sm:pt-6">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          <div
            {...dragHandleProps?.attributes}
            {...dragHandleProps?.listeners}
            className="touch-none select-none cursor-grab active:cursor-grabbing p-0.5 sm:p-1 -m-0.5 sm:-m-1 rounded hover:bg-muted/50"
            data-testid={`drag-handle-${config.id}`}
          >
            <GripVertical className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-xs sm:text-base truncate">{chartInfo.name}</CardTitle>
            <CardDescription className="text-[10px] sm:text-xs truncate hidden sm:block">{chartInfo.description}</CardDescription>
          </div>
        </div>
        <div className="flex items-center shrink-0">
          {onToggleWidth && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 sm:h-7 sm:w-7"
              onClick={() => onToggleWidth(config.id)}
              data-testid={`button-toggle-width-${config.id}`}
            >
              {config.width === "full" ? (
                <Minimize2 className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
              ) : (
                <Maximize2 className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
              )}
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 sm:h-7 sm:w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(config.id)}
              data-testid={`button-remove-chart-${config.id}`}
            >
              <X className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6 pb-2 sm:pb-6">
        <div className="h-[220px] sm:h-[300px]">
          <ChartRenderer
            chartType={config.chartType as DashboardChartType}
            ingredients={ingredients}
            recipes={recipes}
            wasteLogs={wasteLogs}
            height="100%"
            customConfig={config.customConfig}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface ChartRendererProps {
  chartType: DashboardChartType;
  ingredients: Ingredient[];
  recipes: Recipe[];
  wasteLogs?: WasteLog[];
  height: number | string;
  customConfig?: unknown;
}

function ChartRenderer({ chartType, ingredients, recipes, wasteLogs = [], height }: ChartRendererProps) {
  switch (chartType) {
    case "most_expensive_recipes":
      return <MostExpensiveRecipesChart recipes={recipes} height={height} />;
    case "cost_efficient_recipes":
      return <CostEfficientRecipesChart recipes={recipes} height={height} />;
    case "ingredients_by_category":
      return <IngredientsByCategoryChart ingredients={ingredients} height={height} />;
    case "margin_analysis":
      return <MarginAnalysisChart recipes={recipes} height={height} />;
    case "food_cost_percentage":
      return <FoodCostPercentageChart recipes={recipes} height={height} />;
    case "menu_engineering_matrix":
      return <MenuEngineeringMatrixChart recipes={recipes} height={height} />;
    case "top_revenue_drivers":
      return <TopRevenueDriversChart recipes={recipes} height={height} />;
    case "waste_impact":
      return <WasteImpactChart wasteLogs={wasteLogs} ingredients={ingredients} height={height} />;
    case "inventory_value":
      return <InventoryValueChart ingredients={ingredients} height={height} />;
    case "ingredient_price_trends":
      return <IngredientPriceTrendsChart ingredients={ingredients} height={height} />;
    case "profit_margin_distribution":
      return <ProfitMarginDistributionChart recipes={recipes} height={height} />;
    case "category_performance":
      return <CategoryPerformanceChart recipes={recipes} height={height} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p>Unknown chart type: {chartType}</p>
        </div>
      );
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground text-center py-8">{message}</p>
  );
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "var(--radius)",
  color: "hsl(var(--card-foreground))",
};

function MostExpensiveRecipesChart({ recipes, height }: { recipes: Recipe[]; height: number | string }) {
  const data = [...recipes]
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

  if (data.length === 0) {
    return <EmptyState message="No recipes yet. Create your first recipe to see cost analysis." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
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
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `$${value.toFixed(2)}`} />
        <Bar dataKey="cost" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CostEfficientRecipesChart({ recipes, height }: { recipes: Recipe[]; height: number | string }) {
  const data = [...recipes]
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

  if (data.length === 0) {
    return <EmptyState message="No recipes yet. Create your first recipe to see cost analysis." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
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
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `$${value.toFixed(2)}`} />
        <Bar dataKey="cost" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function IngredientsByCategoryChart({ ingredients, height }: { ingredients: Ingredient[]; height: number | string }) {
  const categoryData = ingredients.reduce((acc, ing) => {
    const existing = acc.find((item) => item.name === ing.category);
    if (existing) {
      existing.count += 1;
      existing.value += (ing.costPerUnit || 0) * (ing.currentStock || ing.purchaseQuantity);
    } else {
      acc.push({
        name: ing.category,
        count: 1,
        value: (ing.costPerUnit || 0) * (ing.currentStock || ing.purchaseQuantity),
      });
    }
    return acc;
  }, [] as Array<{ name: string; count: number; value: number }>);

  if (categoryData.length === 0) {
    return <EmptyState message="No ingredients yet. Add ingredients to see category breakdown." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={categoryData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="count"
        >
          {categoryData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={tooltipStyle} 
          itemStyle={{ color: "hsl(var(--card-foreground))" }}
          labelStyle={{ color: "hsl(var(--card-foreground))" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function MarginAnalysisChart({ recipes, height }: { recipes: Recipe[]; height: number | string }) {
  const data = [...recipes]
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

  if (data.length === 0) {
    return <EmptyState message="No recipes with menu prices yet. Set menu prices to see margin analysis." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
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
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `$${value.toFixed(2)}`} />
        <Bar dataKey="profit" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FoodCostPercentageChart({ recipes, height }: { recipes: Recipe[]; height: number | string }) {
  const data = [...recipes]
    .filter((r) => r.menuPrice && r.menuPrice > 0)
    .map((r) => {
      const costPerServing = r.servings > 0 ? r.totalCost / r.servings : 0;
      const foodCostPct = (costPerServing / (r.menuPrice || 1)) * 100;
      return {
        name: r.name.length > 12 ? r.name.substring(0, 12) + "..." : r.name,
        foodCostPct: Math.round(foodCostPct * 10) / 10,
        isInRange: foodCostPct >= 20 && foodCostPct <= 24,
      };
    })
    .sort((a, b) => b.foodCostPct - a.foodCostPct)
    .slice(0, 8);

  if (data.length === 0) {
    return <EmptyState message="Set menu prices to see food cost percentages." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          domain={[0, 100]}
          className="text-xs fill-muted-foreground"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          className="text-xs fill-muted-foreground"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${value.toFixed(1)}%`} />
        <ReferenceLine x={20} stroke="hsl(var(--chart-4))" strokeDasharray="5 5" />
        <ReferenceLine x={24} stroke="hsl(var(--chart-4))" strokeDasharray="5 5" />
        <Bar
          dataKey="foodCostPct"
          radius={[0, 4, 4, 0]}
          fill="hsl(var(--chart-1))"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MenuEngineeringMatrixChart({ recipes, height }: { recipes: Recipe[]; height: number | string }) {
  const recipesWithMetrics = recipes
    .filter((r) => r.menuPrice && r.menuPrice > 0)
    .map((r) => {
      const costPerServing = r.servings > 0 ? r.totalCost / r.servings : 0;
      const profit = (r.menuPrice || 0) - costPerServing;
      const marginPct = ((profit / (r.menuPrice || 1)) * 100);
      return {
        name: r.name.length > 10 ? r.name.substring(0, 10) + "..." : r.name,
        profit,
        marginPct,
        popularity: Math.random() * 100, // Placeholder - would need sales data
      };
    });

  if (recipesWithMetrics.length === 0) {
    return <EmptyState message="Set menu prices to see menu engineering analysis." />;
  }

  const avgMargin = recipesWithMetrics.reduce((sum, r) => sum + r.marginPct, 0) / recipesWithMetrics.length;
  const avgPopularity = 50; // Center line for popularity

  const data = recipesWithMetrics.map((r) => {
    let category: string;
    if (r.marginPct >= avgMargin && r.popularity >= avgPopularity) {
      category = "Star";
    } else if (r.marginPct >= avgMargin && r.popularity < avgPopularity) {
      category = "Puzzle";
    } else if (r.marginPct < avgMargin && r.popularity >= avgPopularity) {
      category = "Plowhorse";
    } else {
      category = "Dog";
    }
    return { ...r, category };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          dataKey="popularity"
          name="Popularity"
          domain={[0, 100]}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          label={{ value: "Popularity", position: "bottom", fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          type="number"
          dataKey="marginPct"
          name="Margin %"
          domain={[0, 100]}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          label={{ value: "Margin %", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number, name: string) => [
            name === "marginPct" ? `${value.toFixed(1)}%` : value.toFixed(0),
            name === "marginPct" ? "Margin" : name,
          ]}
        />
        <ReferenceLine x={avgPopularity} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
        <ReferenceLine y={avgMargin} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
        <Scatter name="Menu Items" data={data} fill="hsl(var(--chart-1))">
          {data.map((entry, index) => {
            const color = entry.category === "Star" ? COLORS[2] :
                          entry.category === "Puzzle" ? COLORS[3] :
                          entry.category === "Plowhorse" ? COLORS[1] : COLORS[0];
            return <Cell key={`cell-${index}`} fill={color} />;
          })}
        </Scatter>
        <Legend
          payload={[
            { value: "Star (High Margin, High Pop)", type: "circle", color: COLORS[2] },
            { value: "Puzzle (High Margin, Low Pop)", type: "circle", color: COLORS[3] },
            { value: "Plowhorse (Low Margin, High Pop)", type: "circle", color: COLORS[1] },
            { value: "Dog (Low Margin, Low Pop)", type: "circle", color: COLORS[0] },
          ]}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function TopRevenueDriversChart({ recipes, height }: { recipes: Recipe[]; height: number | string }) {
  const data = [...recipes]
    .filter((r) => r.menuPrice && r.menuPrice > 0)
    .map((r) => {
      const costPerServing = r.servings > 0 ? r.totalCost / r.servings : 0;
      const profitPerUnit = (r.menuPrice || 0) - costPerServing;
      // Simulate sales volume (in real app, this would come from sales data)
      const estimatedVolume = Math.floor(Math.random() * 50) + 10;
      return {
        name: r.name.length > 12 ? r.name.substring(0, 12) + "..." : r.name,
        revenue: profitPerUnit * estimatedVolume,
        profitPerUnit,
        volume: estimatedVolume,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  if (data.length === 0) {
    return <EmptyState message="Set menu prices to see revenue drivers." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
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
          contentStyle={tooltipStyle}
          formatter={(value: number, name: string) => [
            `$${value.toFixed(2)}`,
            name === "revenue" ? "Total Profit" : name,
          ]}
        />
        <Bar dataKey="revenue" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function WasteImpactChart({
  wasteLogs,
  ingredients,
  height,
}: {
  wasteLogs: WasteLog[];
  ingredients: Ingredient[];
  height: number | string;
}) {
  if (wasteLogs.length === 0) {
    return <EmptyState message="No waste logs yet. Log waste to see impact analysis." />;
  }

  // Group waste by ingredient category
  const wasteByCategory = wasteLogs.reduce((acc, log) => {
    const ingredient = ingredients.find((i) => i.id === log.ingredientId);
    const category = ingredient?.category || "Unknown";
    const existing = acc.find((item) => item.name === category);
    if (existing) {
      existing.cost += log.costAtTime;
      existing.count += 1;
    } else {
      acc.push({ name: category, cost: log.costAtTime, count: 1 });
    }
    return acc;
  }, [] as Array<{ name: string; cost: number; count: number }>);

  const sortedData = wasteByCategory.sort((a, b) => b.cost - a.cost).slice(0, 6);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sortedData}>
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
          contentStyle={tooltipStyle}
          formatter={(value: number, name: string) => [
            name === "cost" ? `$${value.toFixed(2)}` : value,
            name === "cost" ? "Waste Cost" : "Items",
          ]}
        />
        <Bar dataKey="cost" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function InventoryValueChart({ ingredients, height }: { ingredients: Ingredient[]; height: number | string }) {
  const categoryValue = ingredients.reduce((acc, ing) => {
    const value = (ing.costPerUnit || 0) * (ing.currentStock || ing.purchaseQuantity);
    const existing = acc.find((item) => item.name === ing.category);
    if (existing) {
      existing.value += value;
    } else {
      acc.push({ name: ing.category, value });
    }
    return acc;
  }, [] as Array<{ name: string; value: number }>);

  if (categoryValue.length === 0) {
    return <EmptyState message="No inventory data. Add ingredients to see value breakdown." />;
  }

  const sortedData = categoryValue.sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={sortedData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name} $${value.toFixed(0)}`}
          outerRadius={80}
          dataKey="value"
        >
          {sortedData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={tooltipStyle} 
          itemStyle={{ color: "hsl(var(--card-foreground))" }}
          labelStyle={{ color: "hsl(var(--card-foreground))" }}
          formatter={(value: number) => `$${value.toFixed(2)}`} 
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function IngredientPriceTrendsChart({ ingredients, height }: { ingredients: Ingredient[]; height: number | string }) {
  // Since we don't have historical price data, show current prices as a snapshot
  const topIngredients = [...ingredients]
    .sort((a, b) => (b.costPerUnit || 0) - (a.costPerUnit || 0))
    .slice(0, 6)
    .map((ing) => ({
      name: ing.name.length > 10 ? ing.name.substring(0, 10) + "..." : ing.name,
      cost: ing.costPerUnit || 0,
    }));

  if (topIngredients.length === 0) {
    return <EmptyState message="No ingredient data. Add ingredients to track prices." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={topIngredients} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          className="text-xs fill-muted-foreground"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          className="text-xs fill-muted-foreground"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `$${value.toFixed(2)}/unit`} />
        <Bar dataKey="cost" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ProfitMarginDistributionChart({ recipes, height }: { recipes: Recipe[]; height: number | string }) {
  const recipesWithMargin = recipes
    .filter((r) => r.menuPrice && r.menuPrice > 0)
    .map((r) => {
      const costPerServing = r.servings > 0 ? r.totalCost / r.servings : 0;
      const margin = ((r.menuPrice! - costPerServing) / r.menuPrice!) * 100;
      return { margin: Math.round(margin) };
    });

  if (recipesWithMargin.length === 0) {
    return <EmptyState message="Set menu prices to see margin distribution." />;
  }

  // Group into buckets
  const buckets = [
    { name: "0-20%", count: 0 },
    { name: "20-40%", count: 0 },
    { name: "40-60%", count: 0 },
    { name: "60-80%", count: 0 },
    { name: "80-100%", count: 0 },
  ];

  recipesWithMargin.forEach((r) => {
    if (r.margin < 20) buckets[0].count++;
    else if (r.margin < 40) buckets[1].count++;
    else if (r.margin < 60) buckets[2].count++;
    else if (r.margin < 80) buckets[3].count++;
    else buckets[4].count++;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={buckets}>
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
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} recipes`, "Count"]} />
        <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CategoryPerformanceChart({ recipes, height }: { recipes: Recipe[]; height: number | string }) {
  const categoryStats = recipes.reduce((acc, r) => {
    const category = r.category || "other";
    const costPerServing = r.servings > 0 ? r.totalCost / r.servings : 0;
    const margin = r.menuPrice && r.menuPrice > 0
      ? ((r.menuPrice - costPerServing) / r.menuPrice) * 100
      : 0;

    const existing = acc.find((item) => item.name === category);
    if (existing) {
      existing.count += 1;
      existing.totalMargin += margin;
      existing.avgMargin = existing.totalMargin / existing.count;
    } else {
      acc.push({
        name: category,
        count: 1,
        totalMargin: margin,
        avgMargin: margin,
      });
    }
    return acc;
  }, [] as Array<{ name: string; count: number; totalMargin: number; avgMargin: number }>);

  if (categoryStats.length === 0) {
    return <EmptyState message="Add recipes to see category performance." />;
  }

  const data = categoryStats.map((cat) => ({
    name: cat.name.charAt(0).toUpperCase() + cat.name.slice(1).replace("_", " "),
    avgMargin: Math.round(cat.avgMargin * 10) / 10,
    count: cat.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="name"
          className="text-xs fill-muted-foreground"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          className="text-xs fill-muted-foreground"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number, name: string) => [
            name === "avgMargin" ? `${value.toFixed(1)}%` : value,
            name === "avgMargin" ? "Avg Margin" : "Recipe Count",
          ]}
        />
        <Bar dataKey="avgMargin" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export { COLORS };
