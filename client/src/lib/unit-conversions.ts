import type { MeasurementUnit, Ingredient } from "@shared/schema";
import { calculateCostPerUnit, unitFamilyMap } from "@shared/cost-calculator";

const conversionToGrams: Record<MeasurementUnit, number> = {
  grams: 1,
  kilograms: 1000,
  ounces: 28.3495,
  pounds: 453.592,
  cups: 240,
  teaspoons: 4.92892,
  tablespoons: 14.7868,
  milliliters: 1,
  liters: 1000,
  pints: 473.176,
  quarts: 946.353,
  gallons: 3785.41,
  units: 1,
};

export function convertUnits(
  quantity: number,
  fromUnit: MeasurementUnit,
  toUnit: MeasurementUnit
): number {
  if (fromUnit === toUnit) return quantity;
  if (fromUnit === "units" || toUnit === "units") return quantity;
  
  const grams = quantity * conversionToGrams[fromUnit];
  return grams / conversionToGrams[toUnit];
}

export function calculateIngredientCost(
  ingredient: Ingredient,
  recipeQuantity: number,
  recipeUnit: MeasurementUnit
): number {
  // Get the appropriate cost per unit based on the recipe unit
  const costPerUnitMap: Record<MeasurementUnit, number | null> = {
    cups: ingredient.costPerCup,
    ounces: ingredient.costPerOunce,
    grams: ingredient.costPerGram,
    units: ingredient.costPerUnit,
    teaspoons: ingredient.costPerTsp,
    tablespoons: ingredient.costPerTbsp,
    pounds: ingredient.costPerPound,
    kilograms: ingredient.costPerKg,
    milliliters: ingredient.costPerMl,
    liters: ingredient.costPerLiter,
    pints: ingredient.costPerPint,
    quarts: ingredient.costPerQuart,
    gallons: ingredient.costPerGallon,
  };

  let costPerUnit = costPerUnitMap[recipeUnit];
  
  // Fallback: If pre-calculated cost is null, calculate on demand from purchase data using shared logic
  if (costPerUnit === null || costPerUnit === undefined) {
    // Check that we have valid purchase data for fallback calculation
    if (
      ingredient.purchaseQuantity &&
      ingredient.purchaseUnit &&
      ingredient.purchaseCost !== null &&
      ingredient.purchaseCost !== undefined
    ) {
      // Use shared cost calculator to ensure consistency (with density if available)
      const options = ingredient.gramsPerMilliliter 
        ? { densityGramsPerMl: ingredient.gramsPerMilliliter }
        : undefined;
      
      costPerUnit = calculateCostPerUnit(
        ingredient.purchaseQuantity,
        ingredient.purchaseUnit as MeasurementUnit,
        ingredient.purchaseCost,
        recipeUnit,
        options
      );
      
      // Still null means incompatible units or missing density for cross-family conversion
      if (costPerUnit === null) {
        if (!ingredient.gramsPerMilliliter) {
          console.warn(
            `Cross-family conversion from ${ingredient.purchaseUnit} to ${recipeUnit} requires density for ingredient ${ingredient.name}. Add density to enable accurate cost calculation.`
          );
        } else {
          console.warn(
            `Cannot convert between ${ingredient.purchaseUnit} and ${recipeUnit} for ingredient ${ingredient.name}`
          );
        }
        return 0;
      }
    } else {
      // Missing purchase data - cannot calculate cost
      console.error(
        `Missing purchase data for ingredient ${ingredient.name}, cannot calculate cost for ${recipeUnit}`
      );
      return 0;
    }
  }
  
  return recipeQuantity * costPerUnit;
}

/**
 * Check if an ingredient needs density for accurate cost calculation in a given unit
 * Returns warning info if density is required but missing
 */
export function checkDensityWarning(
  ingredient: Ingredient | null,
  recipeUnit: MeasurementUnit
): {
  needsWarning: boolean;
  warningType: "cross-family" | "incompatible" | null;
  message: string;
} {
  if (!ingredient) {
    return { needsWarning: false, warningType: null, message: "" };
  }

  const purchaseFamily = unitFamilyMap[ingredient.purchaseUnit as MeasurementUnit];
  const recipeFamily = unitFamilyMap[recipeUnit];

  // Same family - no warning needed
  if (purchaseFamily === recipeFamily) {
    return { needsWarning: false, warningType: null, message: "" };
  }

  // "each" to/from other families - incompatible conversion
  if (purchaseFamily === "each" || recipeFamily === "each") {
    return {
      needsWarning: true,
      warningType: "incompatible",
      message: `Cannot convert between "${ingredient.purchaseUnit}" and "${recipeUnit}". Change the recipe unit to match the purchase unit, or use a different ingredient.`,
    };
  }

  // Cross-family conversion (volume ↔ weight)
  // Check if ingredient has density
  if (!ingredient.gramsPerMilliliter) {
    return {
      needsWarning: true,
      warningType: "cross-family",
      message: `${ingredient.name} requires density for accurate conversion from "${ingredient.purchaseUnit}" to "${recipeUnit}". Edit the ingredient to add density.`,
    };
  }

  // Has density - no warning
  return { needsWarning: false, warningType: null, message: "" };
}
