import { measurementUnits, type MeasurementUnit } from "./schema";

/**
 * Unit aliases map for parsing user input
 * Maps common variations to canonical unit names
 */
const unitAliases: Record<string, MeasurementUnit> = {
  // Weight
  "oz": "ounces",
  "ounce": "ounces",
  "lb": "pounds",
  "lbs": "pounds",
  "pound": "pounds",
  "g": "grams",
  "gram": "grams",
  "kg": "kilograms",
  "kilo": "kilograms",
  "kilogram": "kilograms",
  
  // Volume
  "cup": "cups",
  "tsp": "teaspoons",
  "teaspoon": "teaspoons",
  "tbsp": "tablespoons",
  "tablespoon": "tablespoons",
  "ml": "milliliters",
  "milliliter": "milliliters",
  "l": "liters",
  "liter": "liters",
  "pt": "pints",
  "pint": "pints",
  "qt": "quarts",
  "quart": "quarts",
  "gal": "gallons",
  "gallon": "gallons",
  
  // Each
  "unit": "units",
  "each": "units",
  "ea": "units",
  "pc": "units",
  "piece": "units",
  "count": "units",
};

export interface ParsedQuantity {
  quantity: number;
  unit: MeasurementUnit;
  originalString: string;
}

/**
 * Parse mixed quantity/unit strings like "1lb", "64oz", "12 quarts"
 * Returns null if parsing fails
 */
export function parseQuantityUnit(input: string): ParsedQuantity | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim().toLowerCase();
  
  // Try to match: number + optional space + unit
  // Examples: "1lb", "64 oz", "12quarts", "5 cups"
  const match = trimmed.match(/^(\d+\.?\d*)\s*([a-z]+)$/);
  
  if (!match) {
    return null;
  }

  const [, quantityStr, unitStr] = match;
  const quantity = parseFloat(quantityStr);
  
  if (isNaN(quantity) || quantity <= 0) {
    return null;
  }

  // Look up canonical unit name
  const canonicalUnit = unitAliases[unitStr];
  
  if (!canonicalUnit) {
    return null;
  }

  return {
    quantity,
    unit: canonicalUnit,
    originalString: input.trim(),
  };
}

/**
 * Normalize a unit string to canonical form
 */
export function normalizeUnit(unit: string): MeasurementUnit | null {
  const normalized = unit.trim().toLowerCase();
  return unitAliases[normalized] || (measurementUnits.includes(normalized as any) ? normalized as MeasurementUnit : null);
}
