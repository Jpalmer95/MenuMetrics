import type { MeasurementUnit } from "./schema";

// Unit families for conversion logic
export type UnitFamily = "weight" | "volume" | "each";

// Map each measurement unit to its family
export const unitFamilyMap: Record<MeasurementUnit, UnitFamily> = {
  // Weight units
  grams: "weight",
  kilograms: "weight",
  ounces: "weight", // Treated as weight oz (not fluid oz)
  pounds: "weight",
  
  // Volume units
  cups: "volume",
  teaspoons: "volume",
  tablespoons: "volume",
  milliliters: "volume",
  liters: "volume",
  pints: "volume",
  quarts: "volume",
  gallons: "volume",
  
  // Each (discrete items)
  units: "each",
};

// Conversion factors: weight units to grams
const weightToGrams: Record<string, number> = {
  grams: 1,
  kilograms: 1000,
  ounces: 28.3495,
  pounds: 453.592,
};

// Conversion factors: volume units to milliliters
const volumeToMilliliters: Record<string, number> = {
  milliliters: 1,
  liters: 1000,
  teaspoons: 4.92892,
  tablespoons: 14.7868,
  cups: 236.588, // Standard US cup
  pints: 473.176,
  quarts: 946.353,
  gallons: 3785.41,
};

/**
 * Calculate the cost per specific unit given purchase data with optional density for cross-family conversions
 * @param purchaseQuantity - Quantity purchased (e.g., 32)
 * @param purchaseUnit - Unit of purchase (e.g., "quarts")
 * @param purchaseCost - Total cost of purchase (e.g., $5.90)
 * @param targetUnit - Unit to calculate cost for (e.g., "ounces")
 * @param options - Optional density for volume↔weight conversions
 * @returns Cost per target unit, or null if conversion not possible
 */
export function calculateCostPerUnit(
  purchaseQuantity: number,
  purchaseUnit: MeasurementUnit,
  purchaseCost: number,
  targetUnit: MeasurementUnit,
  options?: { densityGramsPerMl?: number }
): number | null {
  const purchaseFamily = unitFamilyMap[purchaseUnit];
  const targetFamily = unitFamilyMap[targetUnit];
  
  // Handle "each" (units) - only convert if both are "each"
  if (purchaseFamily === "each" || targetFamily === "each") {
    if (purchaseFamily === "each" && targetFamily === "each") {
      return purchaseCost / purchaseQuantity;
    }
    return null; // Can't convert between "each" and weight/volume
  }
  
  // Same-family conversions (weight↔weight or volume↔volume)
  if (purchaseFamily === targetFamily) {
    if (purchaseFamily === "weight") {
      // Both are weight units - convert via grams
      const totalGrams = purchaseQuantity * weightToGrams[purchaseUnit];
      const costPerGram = purchaseCost / totalGrams;
      return costPerGram * weightToGrams[targetUnit];
    } else {
      // Both are volume units - convert via milliliters
      const totalMl = purchaseQuantity * volumeToMilliliters[purchaseUnit];
      const costPerMl = purchaseCost / totalMl;
      return costPerMl * volumeToMilliliters[targetUnit];
    }
  }
  
  // Cross-family conversion (weight↔volume) requires density
  if (!options?.densityGramsPerMl) {
    return null; // Can't convert without density
  }
  
  const density = options.densityGramsPerMl;
  
  if (purchaseFamily === "volume" && targetFamily === "weight") {
    // Volume → Weight: convert volume to mL, multiply by density to get grams, then to target weight unit
    const totalMl = purchaseQuantity * volumeToMilliliters[purchaseUnit];
    const totalGrams = totalMl * density;
    const costPerGram = purchaseCost / totalGrams;
    return costPerGram * weightToGrams[targetUnit];
  } else {
    // Weight → Volume: convert weight to grams, divide by density to get mL, then to target volume unit
    const totalGrams = purchaseQuantity * weightToGrams[purchaseUnit];
    const totalMl = totalGrams / density;
    const costPerMl = purchaseCost / totalMl;
    return costPerMl * volumeToMilliliters[targetUnit];
  }
}

/**
 * Calculate all per-unit costs from purchase data
 * This replicates the HEB spreadsheet breakdown structure
 * @param densityGramsPerMl - Optional density for accurate volume↔weight conversions
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
  purchaseCost: number,
  densityGramsPerMl?: number
): CalculatedUnitCosts {
  const options = densityGramsPerMl ? { densityGramsPerMl } : undefined;
  
  return {
    costPerOunce: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "ounces", options),
    costPerGram: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "grams", options),
    costPerCup: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "cups", options),
    costPerTbsp: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "tablespoons", options),
    costPerTsp: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "teaspoons", options),
    costPerPound: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "pounds", options),
    costPerKg: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "kilograms", options),
    costPerLiter: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "liters", options),
    costPerMl: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "milliliters", options),
    costPerPint: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "pints", options),
    costPerQuart: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "quarts", options),
    costPerGallon: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "gallons", options),
    costPerUnit: calculateCostPerUnit(purchaseQuantity, purchaseUnit, purchaseCost, "units", options),
  };
}
