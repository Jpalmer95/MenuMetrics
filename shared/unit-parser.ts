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
  
  // Volume (including multi-word variants)
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
  
  // Fluid ounces - multi-word variants
  "fl oz": "ounces",
  "floz": "ounces",
  "fluid oz": "ounces",
  "fluid ounce": "ounces",
  
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
  
  // Separate the quantity part from the unit part first
  // This lets us preserve decimals in quantity while removing periods from units
  const firstMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  
  if (!firstMatch) {
    return null;
  }
  
  const [, quantityStr, rawUnit] = firstMatch;
  
  // Normalize the unit part (remove hyphens, underscores, periods, extra spaces)
  // But this won't affect the decimal in the quantity
  const normalized = rawUnit
    .replace(/[\-_\.]/g, ' ')  // Replace hyphens, underscores, and periods with space
    .replace(/\s+/g, ' ')  // Normalize multiple spaces to single space
    .trim();
  
  // Parse quantity
  const quantity = parseFloat(quantityStr);
  
  if (isNaN(quantity) || quantity <= 0) {
    return null;
  }

  // If no unit part, return null
  if (!normalized) {
    return null;
  }

  // Remove trailing 's' for plural handling
  const normalizedUnit = normalized.replace(/s\s*$/, '');
  
  // Look up canonical unit name (try with and without trailing 's')
  const canonicalUnit = unitAliases[normalized] || unitAliases[normalizedUnit];
  
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
 * Handles punctuation variations like "fl. oz", "lb.", "oz.", etc.
 */
export function normalizeUnit(unit: string): MeasurementUnit | null {
  // Normalize punctuation: remove hyphens, underscores, periods
  // Then normalize whitespace
  const normalized = unit
    .trim()
    .toLowerCase()
    .replace(/[\-_\.]/g, ' ')  // Replace punctuation with space
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();
  
  // Try to look up with and without trailing 's'
  const withoutS = normalized.replace(/s\s*$/, '');
  
  return unitAliases[normalized] || unitAliases[withoutS] || (measurementUnits.includes(normalized as any) ? normalized as MeasurementUnit : null);
}
