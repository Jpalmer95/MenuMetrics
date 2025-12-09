/**
 * Utility for looking up ingredient densities from reference table using fuzzy matching
 * Allows ingredient names like "HCF Whole Milk" to match "Whole Milk" density
 */

import { findBestMatch, type FuzzyMatchResult } from "./fuzzy-matcher";

export interface DensityReference {
  id: string;
  ingredientName: string;
  gramsPerMilliliter: number;
  category?: string;
  notes?: string;
}

/**
 * Find matching density from reference table for a given ingredient name
 * Uses fuzzy matching to handle variations like "HCF Whole Milk" → "Whole Milk"
 */
export function findMatchingDensity(
  ingredientName: string,
  densityReferences: DensityReference[]
): FuzzyMatchResult<DensityReference> | null {
  if (!ingredientName.trim() || densityReferences.length === 0) {
    return null;
  }

  // Map densityReferences to have 'name' property for fuzzy matching
  // and filter out any invalid entries
  const refsWithName = densityReferences
    .filter(ref => ref.ingredientName && ref.ingredientName.trim())
    .map(ref => ({ ...ref, name: ref.ingredientName }));
  
  if (refsWithName.length === 0) {
    return null;
  }

  const result = findBestMatch(ingredientName, refsWithName, {
    autoMatchThreshold: 0.75, // Lower threshold for density matching - be more permissive
    minThreshold: 0.6,
    useNormalization: true,
  });

  if (!result) {
    return null;
  }

  // Return the original DensityReference (without the added 'name' property)
  const { name, ...originalRef } = result.match;
  return {
    ...result,
    match: originalRef as DensityReference,
  };
}

/**
 * Get suggested density value for an ingredient
 * Returns the density value if found, or null
 */
export function getSuggestedDensity(
  ingredientName: string,
  densityReferences: DensityReference[]
): number | null {
  const match = findMatchingDensity(ingredientName, densityReferences);
  return match ? match.match.gramsPerMilliliter : null;
}
