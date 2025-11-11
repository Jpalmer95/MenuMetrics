import type { MeasurementUnit } from "@shared/schema";

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
  ingredientQuantity: number,
  ingredientUnit: MeasurementUnit,
  ingredientCostPerUnit: number,
  recipeQuantity: number,
  recipeUnit: MeasurementUnit
): number {
  const convertedQuantity = convertUnits(recipeQuantity, recipeUnit, ingredientUnit);
  return (convertedQuantity / ingredientQuantity) * ingredientCostPerUnit;
}
