import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { 
  TrendingDown, 
  Calendar,
  DollarSign,
  PieChart,
  BarChart3,
  AlertTriangle,
  Loader2,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import type { WasteLogWithIngredient } from "@shared/schema";
import { wasteReasonLabels, type WasteReason } from "@shared/schema";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

const REASON_COLORS: Record<string, string> = {
  expired: "#ef4444",
  broken: "#f59e0b", 
  misordered: "#3b82f6",
  overproduction: "#8b5cf6",
  spillage: "#f97316",
  other: "#6b7280",
};

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  trend,
  trendLabel,
}: { 
  title: string; 
  value: string; 
  subtitle?: string;
  icon: typeof DollarSign;
  trend?: "up" | "down" | null;
  trendLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {trend === "up" && (
              <Badge variant="secondary" className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                {trendLabel}
              </Badge>
            )}
            {trend === "down" && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <ArrowDownRight className="h-3 w-3 mr-1" />
                {trendLabel}
              </Badge>
            )}
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WasteAnalyticsPage() {
  const [timePeriod, setTimePeriod] = useState<number>(30);

  const { data: wasteLogs = [], isLoading } = useQuery<WasteLogWithIngredient[]>({
    queryKey: ["/api/waste-logs"],
  });

  const analytics = useMemo(() => {
    const now = new Date();
    const periodStart = subDays(now, timePeriod);
    const prevPeriodStart = subDays(periodStart, timePeriod);
    
    const currentPeriodLogs = wasteLogs.filter(log => new Date(log.wastedAt) >= periodStart);
    const previousPeriodLogs = wasteLogs.filter(log => {
      const date = new Date(log.wastedAt);
      return date >= prevPeriodStart && date < periodStart;
    });

    const currentTotal = currentPeriodLogs.reduce((sum, log) => sum + log.costAtTime, 0);
    const previousTotal = previousPeriodLogs.reduce((sum, log) => sum + log.costAtTime, 0);
    
    let trend: "up" | "down" | null = null;
    let trendPercent = 0;
    if (previousTotal > 0) {
      trendPercent = ((currentTotal - previousTotal) / previousTotal) * 100;
      trend = trendPercent > 5 ? "up" : trendPercent < -5 ? "down" : null;
    }

    const byReason: Record<string, { count: number; cost: number }> = {};
    const byIngredient: Record<string, { name: string; count: number; cost: number }> = {};
    const byEmployee: Record<string, { name: string; count: number; cost: number }> = {};
    
    currentPeriodLogs.forEach(log => {
      if (!byReason[log.reason]) {
        byReason[log.reason] = { count: 0, cost: 0 };
      }
      byReason[log.reason].count++;
      byReason[log.reason].cost += log.costAtTime;

      if (!byIngredient[log.ingredientId]) {
        byIngredient[log.ingredientId] = { name: log.ingredient.name, count: 0, cost: 0 };
      }
      byIngredient[log.ingredientId].count++;
      byIngredient[log.ingredientId].cost += log.costAtTime;

      // Employee breakdown
      const empName = (log as any).employeeName || "Unassigned";
      if (!byEmployee[empName]) {
        byEmployee[empName] = { name: empName, count: 0, cost: 0 };
      }
      byEmployee[empName].count++;
      byEmployee[empName].cost += log.costAtTime;
    });

    const reasonData = Object.entries(byReason)
      .map(([reason, data]) => ({
        name: wasteReasonLabels[reason as WasteReason] || reason,
        reason,
        value: data.cost,
        count: data.count,
      }))
      .sort((a, b) => b.value - a.value);

    const topWastedItems = Object.values(byIngredient)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    const employeeBreakdown = Object.values(byEmployee)
      .sort((a, b) => b.cost - a.cost);

    const days = eachDayOfInterval({ start: periodStart, end: now });
    const dailyData = days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayLogs = currentPeriodLogs.filter(log => 
        format(new Date(log.wastedAt), "yyyy-MM-dd") === dayStr
      );
      return {
        date: format(day, timePeriod <= 30 ? "MMM d" : "MMM"),
        cost: dayLogs.reduce((sum, log) => sum + log.costAtTime, 0),
        count: dayLogs.length,
      };
    });

    const avgDailyCost = timePeriod > 0 ? currentTotal / timePeriod : 0;
    const avgPerEntry = currentPeriodLogs.length > 0 
      ? currentTotal / currentPeriodLogs.length 
      : 0;

    return {
      currentTotal,
      previousTotal,
      trend,
      trendPercent: Math.abs(trendPercent),
      reasonData,
      topWastedItems,
      employeeBreakdown,
      dailyData,
      entryCount: currentPeriodLogs.length,
      avgDailyCost,
      avgPerEntry,
      allTimeTotal: wasteLogs.reduce((sum, log) => sum + log.costAtTime, 0),
    };
  }, [wasteLogs, timePeriod]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (wasteLogs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingDown className="h-8 w-8 text-primary" />
            Waste Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyze waste patterns to identify cost-saving opportunities
          </p>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Waste Data Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Start logging waste in the Waste Log page to see analytics and trends here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingDown className="h-8 w-8 text-primary" />
            Waste Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyze waste patterns to identify cost-saving opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[7, 30, 90, 365].map((days) => (
              <Button
                key={days}
                variant={timePeriod === days ? "default" : "outline"}
                size="sm"
                onClick={() => setTimePeriod(days)}
                data-testid={`button-period-${days}`}
              >
                {days === 7 ? "7D" : days === 30 ? "30D" : days === 90 ? "90D" : "1Y"}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const csv = ["Date,Ingredient,Quantity,Unit,Reason,Cost,Employee"].concat(
                wasteLogs
                  .filter(l => new Date(l.wastedAt) >= subDays(new Date(), timePeriod))
                  .map(l => `${format(new Date(l.wastedAt), "yyyy-MM-dd")},${l.ingredient.name},${l.quantity},${l.unit},${l.reason},${l.costAtTime.toFixed(2)},${(l as any).employeeName || ""}`)
              ).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `waste-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
              a.click();
            }}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={`Last ${timePeriod} Days`}
          value={formatCurrency(analytics.currentTotal)}
          icon={Calendar}
          trend={analytics.trend}
          trendLabel={`${analytics.trendPercent.toFixed(0)}% vs prev`}
        />
        <StatCard
          title="Daily Average"
          value={formatCurrency(analytics.avgDailyCost)}
          subtitle="per day"
          icon={DollarSign}
        />
        <StatCard
          title="Waste Entries"
          value={analytics.entryCount.toString()}
          subtitle={`last ${timePeriod} days`}
          icon={Package}
        />
        <StatCard
          title="Avg Per Entry"
          value={formatCurrency(analytics.avgPerEntry)}
          subtitle="cost per incident"
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Waste Trend (30 Days)
            </CardTitle>
            <CardDescription>Daily waste costs over the past month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.dailyData}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), "Cost"]}
                    labelStyle={{ fontWeight: "bold" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#colorCost)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Waste by Reason
            </CardTitle>
            <CardDescription>Cost distribution by waste category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={analytics.reasonData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {analytics.reasonData.map((entry) => (
                      <Cell 
                        key={entry.reason} 
                        fill={REASON_COLORS[entry.reason] || "#6b7280"} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Wasted Items</CardTitle>
            <CardDescription>Ingredients with highest waste costs (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.topWastedItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No waste data for this period
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={analytics.topWastedItems.slice(0, 8)} 
                    layout="vertical"
                    margin={{ left: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis 
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <YAxis 
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      width={90}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), "Waste Cost"]}
                    />
                    <Bar dataKey="cost" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Waste Breakdown by Reason</CardTitle>
            <CardDescription>Detailed breakdown of waste causes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.reasonData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No waste data for this period
                </div>
              ) : (
                analytics.reasonData.map((item) => {
                  const percentage = analytics.currentTotal > 0 
                    ? (item.value / analytics.currentTotal) * 100 
                    : 0;
                  return (
                    <div key={item.reason} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: REASON_COLORS[item.reason] }}
                          />
                          <span className="font-medium">{item.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {item.count} entries
                          </Badge>
                        </div>
                        <span className="font-medium">{formatCurrency(item.value)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: REASON_COLORS[item.reason],
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All-Time Summary</CardTitle>
          <CardDescription>
            Total waste tracking since you started logging
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-destructive">
                {formatCurrency(analytics.allTimeTotal)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Total Waste Cost</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">{wasteLogs.length}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Entries</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">
                {formatCurrency(wasteLogs.length > 0 ? analytics.allTimeTotal / wasteLogs.length : 0)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Average Per Entry</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
