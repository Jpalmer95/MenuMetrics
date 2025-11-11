import type { MeasurementUnit } from "./schema";

// Conversion factors to convert any unit to grams (or mL for liquids)
const conversionToGrams: Record<MeasurementUnit, number> = {
  grams: 1,
  kilograms: 1000,
  ounces: 28.3495,
  pounds: 453.592,
  cups: 240, // Assuming 240g for 1 cup (liquid measurement)
  teaspoons: 4.92892,
  tablespoons: 14.7868,
  milliliters: 1,
  liters: 1000,
  pints: 473.176,
  quarts: 946.353,
  gallons: 3785.41,
  units: 1, // For items sold as "each"
};

/**
 * Calculate the cost per specific unit given purchase data
 * @param purchaseQuantity - Quantity purchased (e.g., 32)
 * @param purchaseUnit - Unit of purchase (e.g., "quarts")
 * @param purchaseCost - Total cost of purchase (e.g., $5.90)
 * @param targetUnit - Unit to calculate cost for (e.g., "ounces")
 * @returns Cost per target unit, or null if conversion not possible
 */
export function calculateCostPerUnit(
  purchaseQuantity: number,
  purchaseUnit: MeasurementUnit,
  purchaseCost: number,
  targetUnit: MeasurementUnit
): number | null {
  // Handle "units" (each) specially
  if (purchaseUnit === "units" && targetUnit === "units") {
    return purchaseCost / purchaseQuantity;
  }
  
  // Can't convert between "units" and weight/volume measurements
  if (purchaseUnit === "units" || targetUnit === "units") {
    return null;
  }
  
  // Convert purchase quantity to grams
  const totalGrams = purchaseQuantity * conversionToGrams[purchaseUnit];
  
  // Calculate cost per gram
  const costPerGram = purchaseCost / totalGrams;
  
  // Convert to target unit
  const costPerTargetUnit = costPerGram * conversionToGrams[targetUnit];
  
  return costPerTargetUnit;
}

/**
 * Calculate all per-unit costs from purchase data
 * This replicates the HEB spreadsheet breakdown structure
 */
export interface CalculatedUnitCosts {
  costPerOunce: number | null;
  costPerGram: number | null;
  costPerCup: number | null;
  costPerTbsp: number | null;
  costPerTsp: number | null;
  costPerPound: number | null;
  costPerKg: number | null;
  costPerLiter: number | null;
  costPerMl: number | null;
  costPerPint: number | null;
  costPerQuart: number | null;
  costPerGallon: number | null;
  costPerUnit: number | null;
}

export function calculateAllUnitCosts(
  purchaseQuantity: number,
  purchaseUnit: MeasurementUnit,
  purchaseCost: number
): CalculatedUnitCosts {
  return {
    costPerOunce: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "ounces"),
    costPerGram: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "grams"),
    costPerCup: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "cups"),
    costPerTbsp: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "tablespoons"),
    costPerTsp: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "teaspoons"),
    costPerPound: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "pounds"),
    costPerKg: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "kilograms"),
    costPerLiter: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "liters"),
    costPerMl: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "milliliters"),
    costPerPint: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "pints"),
    costPerQuart: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "quarts"),
    costPerGallon: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "gallons"),
    costPerUnit: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "units"),
  };
}
