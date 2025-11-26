/**
 * Fuzzy string matching utilities for ingredient name resolution
 * Handles variations like "whole milk" vs "Milk", "espresso shots" vs "Espresso"
 */

/**
 * Calculate Dice coefficient between two strings (based on bigrams)
 * Returns a value between 0 and 1, where 1 is an exact match
 */
function diceCoefficient(str1: string, str2: string): number {
  const bigrams1 = getBigrams(str1);
  const bigrams2 = getBigrams(str2);
  
  if (bigrams1.length === 0 && bigrams2.length === 0) {
    return 1; // Both empty
  }
  if (bigrams1.length === 0 || bigrams2.length === 0) {
    return 0; // One empty
  }
  
  // Create multisets (count occurrences)
  const set1 = new Map<string, number>();
  const set2 = new Map<string, number>();
  
  for (const bigram of bigrams1) {
    set1.set(bigram, (set1.get(bigram) || 0) + 1);
  }
  
  for (const bigram of bigrams2) {
    set2.set(bigram, (set2.get(bigram) || 0) + 1);
  }
  
  // Count intersection (minimum occurrence of each bigram)
  let intersection = 0;
  for (const [bigram, count1] of Array.from(set1.entries())) {
    const count2 = set2.get(bigram) || 0;
    intersection += Math.min(count1, count2);
  }
  
  return (2 * intersection) / (bigrams1.length + bigrams2.length);
}

/**
 * Get bigrams (pairs of consecutive characters) from a string
 */
function getBigrams(str: string): string[] {
  const normalized = str.toLowerCase().trim();
  const bigrams: string[] = [];
  
  for (let i = 0; i < normalized.length - 1; i++) {
    bigrams.push(normalized.substring(i, i + 2));
  }
  
  return bigrams;
}

/**
 * Calculate Levenshtein distance ratio between two strings
 * Returns a value between 0 and 1, where 1 is an exact match
 */
function levenshteinRatio(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  if (maxLength === 0) return 1;
  return 1 - (distance / maxLength);
}

/**
 * Calculate Levenshtein distance (edit distance) between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Normalize ingredient name for matching
 * - Converts to lowercase
 * - Removes extra whitespace
 * - Removes common words that don't affect identity (but keeps at least one word)
 * - Singularizes common plural forms
 */
function normalizeIngredientName(name: string): string {
  const original = name.toLowerCase().trim();
  let normalized = original;
  
  // Remove common filler words that don't affect ingredient identity
  const stopWords = ['fresh', 'organic', 'raw', 'pure', 'whole', 'ground', 'dried'];
  for (const word of stopWords) {
    const replaced = normalized.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    const cleaned = replaced.replace(/\s+/g, ' ').trim();
    
    // Only apply replacement if it doesn't result in empty string
    if (cleaned.length > 0) {
      normalized = cleaned;
    }
  }
  
  // Normalize whitespace (if not already done)
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Smarter singularization for common plural patterns only
  // Avoid mangling words that legitimately end in 's' (citrus, glass, etc.)
  let singularized = normalized;
  
  // Pattern 1: words ending in "ies" → "y" (berries → berry)
  singularized = singularized.replace(/\b(\w+)ies\b/gi, '$1y');
  
  // Pattern 2: words ending in "ves" → "f" or "fe" (knives → knife)
  singularized = singularized.replace(/\b(\w+)ves\b/gi, '$1f');
  
  // Pattern 3: words ending in "ses" → "s" (glasses → glass, but citrus stays citrus)
  singularized = singularized.replace(/\b(\w+)ses\b/gi, '$1s');
  
  // Pattern 4: words ending in "xes" → "x" (boxes → box)
  singularized = singularized.replace(/\b(\w+)xes\b/gi, '$1x');
  
  // Pattern 5: words ending in "zes" → "z" (fizzes → fizz)
  singularized = singularized.replace(/\b(\w+)zes\b/gi, '$1z');
  
  // Pattern 6: words ending in consonant + "s" (but not ss, us, is) → remove "s"
  // Only apply if the word is reasonably long and doesn't end in these patterns
  singularized = singularized.replace(/\b(\w{4,}[^aeiousux])s\b/gi, '$1');
  
  if (singularized.length > 0) {
    normalized = singularized;
  }
  
  // Fallback: if somehow empty, return original
  return normalized.length > 0 ? normalized : original;
}

/**
 * Find best matching ingredient from inventory
 * Returns { match, confidence } or null if no good match found
 */
export interface FuzzyMatchResult<T> {
  match: T;
  confidence: number;
  exactMatch: boolean;
}

/**
 * Word-level matching: check if reference words all appear in search string
 * E.g., "pecan halves" should match "Kirkland Pecan Halves (2 lbs)"
 */
function wordLevelMatch(searchStr: string, refStr: string): number {
  const refWords = refStr.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const searchStr_lower = searchStr.toLowerCase();
  
  // If reference is empty, return 0
  if (refWords.length === 0) return 0;
  
  // Count how many reference words appear in the search string
  let matchedWords = 0;
  for (const word of refWords) {
    if (searchStr_lower.includes(word)) {
      matchedWords++;
    }
  }
  
  // Return ratio of matched words (e.g., 2/2 = 1.0 for perfect match)
  return matchedWords / refWords.length;
}

export function findBestMatch<T extends { name: string }>(
  searchName: string,
  inventory: T[],
  options: {
    autoMatchThreshold?: number;  // Auto-accept matches above this (default 0.8)
    minThreshold?: number;         // Reject matches below this (default 0.6)
    useNormalization?: boolean;    // Apply normalization preprocessing (default true)
  } = {}
): FuzzyMatchResult<T> | null {
  const {
    autoMatchThreshold = 0.8,
    minThreshold = 0.6,
    useNormalization = true,
  } = options;
  
  const searchTerm = searchName.toLowerCase().trim();
  
  // First try exact match (case-insensitive)
  for (const item of inventory) {
    if (item.name.toLowerCase().trim() === searchTerm) {
      return {
        match: item,
        confidence: 1.0,
        exactMatch: true,
      };
    }
  }
  
  // Prepare normalized version if enabled
  const normalizedSearch = useNormalization ? normalizeIngredientName(searchName) : searchTerm;
  
  let bestMatch: T | null = null;
  let bestScore = 0;
  
  for (const item of inventory) {
    const itemName = item.name.toLowerCase().trim();
    const normalizedItem = useNormalization ? normalizeIngredientName(item.name) : itemName;
    
    // Calculate multiple similarity scores
    const diceScore = diceCoefficient(normalizedSearch, normalizedItem);
    const levenScore = levenshteinRatio(normalizedSearch, normalizedItem);
    
    // Word-level matching: do all reference words appear in search string?
    // This catches cases like "pecan halves" matching "Kirkland Pecan Halves (2 lbs)"
    const wordMatch = wordLevelMatch(normalizedSearch, normalizedItem);
    
    // If word-level match is perfect or near-perfect, boost confidence significantly
    let score: number;
    if (wordMatch >= 0.9) {
      // If reference words all appear in search, consider it a very strong match
      score = Math.min(1.0, 0.95);
    } else if (wordMatch >= 0.75) {
      // Most words match
      score = Math.min(1.0, (diceScore * 0.3 + levenScore * 0.3 + wordMatch * 0.4));
    } else {
      // Fall back to character-level matching
      const substringBonus = 
        normalizedSearch.length > 0 && 
        normalizedItem.length > 0 && 
        normalizedSearch.length >= 3 && 
        normalizedItem.length >= 3 &&
        (normalizedSearch.includes(normalizedItem) || normalizedItem.includes(normalizedSearch))
          ? 0.15 
          : 0;
      
      score = Math.min(1.0, (diceScore * 0.5 + levenScore * 0.5) + substringBonus);
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }
  
  if (bestMatch && bestScore >= minThreshold) {
    return {
      match: bestMatch,
      confidence: bestScore,
      exactMatch: false,
    };
  }
  
  return null;
}

/**
 * Find all potential matches above a threshold
 * Useful for presenting disambiguation options to users
 */
export function findAllMatches<T extends { name: string }>(
  searchName: string,
  inventory: T[],
  minConfidence: number = 0.6,
  maxResults: number = 5
): FuzzyMatchResult<T>[] {
  const results: FuzzyMatchResult<T>[] = [];
  const searchTerm = searchName.toLowerCase().trim();
  const normalizedSearch = normalizeIngredientName(searchName);
  
  for (const item of inventory) {
    const itemName = item.name.toLowerCase().trim();
    
    // Check exact match
    if (itemName === searchTerm) {
      results.push({
        match: item,
        confidence: 1.0,
        exactMatch: true,
      });
      continue;
    }
    
    const normalizedItem = normalizeIngredientName(item.name);
    
    // Calculate similarity
    const diceScore = diceCoefficient(normalizedSearch, normalizedItem);
    const levenScore = levenshteinRatio(normalizedSearch, normalizedItem);
    
    // Word-level matching
    const wordMatch = wordLevelMatch(normalizedSearch, normalizedItem);
    
    let score: number;
    if (wordMatch >= 0.9) {
      score = Math.min(1.0, 0.95);
    } else if (wordMatch >= 0.75) {
      score = Math.min(1.0, (diceScore * 0.3 + levenScore * 0.3 + wordMatch * 0.4));
    } else {
      const substringBonus = 
        normalizedSearch.length > 0 && 
        normalizedItem.length > 0 && 
        normalizedSearch.length >= 3 && 
        normalizedItem.length >= 3 &&
        (normalizedSearch.includes(normalizedItem) || normalizedItem.includes(normalizedSearch))
          ? 0.15 
          : 0;
      
      score = Math.min(1.0, (diceScore * 0.5 + levenScore * 0.5) + substringBonus);
    }
    
    if (score >= minConfidence) {
      results.push({
        match: item,
        confidence: score,
        exactMatch: false,
      });
    }
  }
  
  // Sort by confidence (highest first) and limit results
  return results
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxResults);
}
