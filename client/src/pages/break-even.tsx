import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Target, DollarSign, Calculator, Loader2, Save, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface BreakEvenRecipe {
  recipeId: string;
  recipeName: string;
  menuPrice: number;
  costPerServing: number;
  contributionMargin: number;
  breakEvenUnits: number | null;
}

interface BreakEvenData {
  fixedCosts: {
    rent: number;
    labor: number;
    utilities: number;
    other: number;
  };
  totalFixed: number;
  recipes: BreakEvenRecipe[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export default function BreakEvenPage() {
  const { toast } = useToast();
  const [fixedCosts, setFixedCosts] = useState({
    rent: 0,
    labor: 0,
    utilities: 0,
    other: 0,
  });

  const { data, isLoading } = useQuery<BreakEvenData>({
    queryKey: ["/api/break-even"],
    onSuccess: (data) => {
      if (data.fixedCosts) {
        setFixedCosts({
          rent: data.fixedCosts.rent || 0,
          labor: data.fixedCosts.labor || 0,
          utilities: data.fixedCosts.utilities || 0,
          other: data.fixedCosts.other || 0,
        });
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/fixed-costs", fixedCosts);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/break-even"] });
      toast({ title: "Fixed costs saved" });
    },
    onError: () => {
      toast({ title: "Failed to save fixed costs", variant: "destructive" });
    },
  });

  const totalFixed = (fixedCosts.rent || 0) + (fixedCosts.labor || 0) +
    (fixedCosts.utilities || 0) + (fixedCosts.other || 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-break-even">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6" />
          Break-Even Analysis
        </h1>
        <p className="text-muted-foreground mt-1">
          Calculate how many units of each item you need to sell to cover your monthly fixed costs
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Monthly Fixed Costs
          </CardTitle>
          <CardDescription>
            Enter your monthly overhead costs to calculate break-even points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Rent</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={fixedCosts.rent || ""}
                onChange={(e) => setFixedCosts(prev => ({ ...prev, rent: parseFloat(e.target.value) || 0 }))}
                placeholder="$0.00"
                className="mt-1"
                data-testid="input-rent"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Labor</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={fixedCosts.labor || ""}
                onChange={(e) => setFixedCosts(prev => ({ ...prev, labor: parseFloat(e.target.value) || 0 }))}
                placeholder="$0.00"
                className="mt-1"
                data-testid="input-labor"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Utilities</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={fixedCosts.utilities || ""}
                onChange={(e) => setFixedCosts(prev => ({ ...prev, utilities: parseFloat(e.target.value) || 0 }))}
                placeholder="$0.00"
                className="mt-1"
                data-testid="input-utilities"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Other</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={fixedCosts.other || ""}
                onChange={(e) => setFixedCosts(prev => ({ ...prev, other: parseFloat(e.target.value) || 0 }))}
                placeholder="$0.00"
                className="mt-1"
                data-testid="input-other"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div>
              <span className="text-sm text-muted-foreground">Total Monthly Fixed Costs: </span>
              <span className="text-lg font-bold">{formatCurrency(totalFixed)}</span>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-costs">
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Costs
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && data.recipes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Break-Even by Menu Item
            </CardTitle>
            <CardDescription>
              Units needed per month to cover ${totalFixed.toFixed(2)} in fixed costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipe</TableHead>
                  <TableHead className="text-right">Menu Price</TableHead>
                  <TableHead className="text-right">Cost/Serving</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Break-Even Units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recipes.map((recipe) => (
                  <TableRow key={recipe.recipeId} data-testid={`break-even-row-${recipe.recipeId}`}>
                    <TableCell className="font-medium">{recipe.recipeName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(recipe.menuPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(recipe.costPerServing)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={recipe.contributionMargin > 0 ? "default" : "destructive"}>
                        {formatCurrency(recipe.contributionMargin)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {recipe.breakEvenUnits !== null ? (
                        <span className={recipe.breakEvenUnits <= 100 ? "text-green-600" : ""}>
                          {recipe.breakEvenUnits.toLocaleString()} units
                        </span>
                      ) : (
                        <span className="text-destructive">N/A</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calculator className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg">No recipes with menu prices</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Add menu prices to your recipes to see break-even analysis
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
