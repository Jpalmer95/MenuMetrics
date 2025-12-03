import {
  type Ingredient,
  type InsertIngredient,
  type Recipe,
  type InsertRecipe,
  type RecipeIngredient,
  type InsertRecipeIngredient,
  type RecipeSubIngredient,
  type InsertRecipeSubIngredient,
  type RecipeWithIngredients,
  type MeasurementUnit,
  type AISettingsData,
  type InsertAISettings,
  type User,
  type UpsertUser,
  type DensityHeuristic,
  type InsertDensityHeuristic,
  type UpdateRecipePricing,
  type CategoryPricingSettings,
  type InsertCategoryPricingSettings,
  type RecipeCategory,
  ingredients,
  recipes,
  recipeIngredients,
  recipeSubIngredients,
  aiSettings,
  users,
  densityHeuristics,
  categoryPricingSettings,
} from "@shared/schema";
import { calculateAllUnitCosts, calculateCostPerUnit } from "@shared/cost-calculator";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // REPLIT AUTH INTEGRATION: User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  getIngredient(id: string, userId: string): Promise<Ingredient | undefined>;
  getAllIngredients(userId: string): Promise<Ingredient[]>;
  createIngredient(ingredient: InsertIngredient, userId: string): Promise<Ingredient>;
  updateIngredient(id: string, ingredient: InsertIngredient, userId: string): Promise<Ingredient | undefined>;
  deleteIngredient(id: string, userId: string): Promise<boolean>;
  
  getRecipe(id: string, userId: string): Promise<Recipe | undefined>;
  getRecipeWithIngredients(id: string, userId: string): Promise<RecipeWithIngredients | undefined>;
  getAllRecipes(userId: string): Promise<Recipe[]>;
  getAllRecipesWithIngredients(userId: string): Promise<RecipeWithIngredients[]>;
  createRecipe(recipe: InsertRecipe, userId: string): Promise<Recipe>;
  updateRecipe(id: string, recipe: InsertRecipe, userId: string): Promise<Recipe | undefined>;
  updateRecipePricing(id: string, pricing: UpdateRecipePricing, userId: string): Promise<Recipe | undefined>;
  updateRecipeCategory(id: string, category: string, userId: string): Promise<Recipe | undefined>;
  updateRecipeName(id: string, name: string, userId: string): Promise<Recipe | undefined>;
  updateRecipePackagingPreset(id: string, isPackagingPreset: boolean, userId: string): Promise<Recipe | undefined>;
  duplicateRecipe(id: string, newName: string, userId: string): Promise<RecipeWithIngredients | undefined>;
  deleteRecipe(id: string, userId: string): Promise<boolean>;
  recalculateRecipeCost(recipeId: string, userId: string): Promise<Recipe | undefined>;
  
  getRecipeIngredients(recipeId: string, userId: string): Promise<Array<RecipeIngredient & { ingredientDetails: Ingredient }>>;
  createRecipeIngredient(recipeIngredient: InsertRecipeIngredient, userId: string): Promise<RecipeIngredient>;
  updateRecipeIngredientQuantity(id: string, quantity: number, userId: string): Promise<RecipeIngredient | undefined>;
  updateRecipeIngredient(id: string, updates: { quantity?: number; unit?: string }, userId: string): Promise<RecipeIngredient | undefined>;
  deleteRecipeIngredient(id: string, userId: string): Promise<boolean>;
  
  getRecipeSubIngredients(recipeId: string, userId: string): Promise<Array<RecipeSubIngredient & { subRecipeDetails: Recipe }>>;
  createRecipeSubIngredient(subIngredient: InsertRecipeSubIngredient, userId: string): Promise<RecipeSubIngredient>;
  updateRecipeSubIngredientQuantity(id: string, quantity: number, userId: string): Promise<RecipeSubIngredient | undefined>;
  deleteRecipeSubIngredient(id: string, userId: string): Promise<boolean>;
  checkCircularDependency(recipeId: string, subRecipeId: string, userId: string): Promise<boolean>;
  
  getAISettings(userId: string): Promise<AISettingsData | undefined>;
  saveAISettings(settings: InsertAISettings, userId: string): Promise<AISettingsData>;
  
  // Density heuristics (global reference densities)
  getAllDensityHeuristics(): Promise<DensityHeuristic[]>;
  updateDensityHeuristic(id: string, updates: Partial<InsertDensityHeuristic>): Promise<DensityHeuristic | undefined>;
  createDensityHeuristic(heuristic: InsertDensityHeuristic): Promise<DensityHeuristic>;
  
  // Category pricing settings
  getCategoryPricingSettings(userId: string): Promise<CategoryPricingSettings[]>;
  getCategoryPricingSetting(userId: string, category: RecipeCategory): Promise<CategoryPricingSettings | undefined>;
  upsertCategoryPricingSetting(settings: InsertCategoryPricingSettings, userId: string): Promise<CategoryPricingSettings>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getIngredient(id: string, userId: string): Promise<Ingredient | undefined> {
    const [ingredient] = await db.select().from(ingredients).where(and(eq(ingredients.id, id), eq(ingredients.userId, userId)));
    return ingredient || undefined;
  }

  async getAllIngredients(userId: string): Promise<Ingredient[]> {
    return await db.select().from(ingredients).where(eq(ingredients.userId, userId));
  }

  async createIngredient(insertIngredient: InsertIngredient, userId: string): Promise<Ingredient> {
    // Calculate all per-unit costs from purchase data (with density and yield if provided)
    const unitCosts = calculateAllUnitCosts(
      insertIngredient.purchaseQuantity,
      insertIngredient.purchaseUnit as MeasurementUnit,
      insertIngredient.purchaseCost,
      insertIngredient.gramsPerMilliliter || undefined,
      insertIngredient.yieldPercentage ?? 97
    );
    
    const [ingredient] = await db
      .insert(ingredients)
      .values({
        ...insertIngredient,
        ...unitCosts,
        userId,
      })
      .returning();
    return ingredient;
  }

  async updateIngredient(id: string, insertIngredient: InsertIngredient, userId: string): Promise<Ingredient | undefined> {
    // Recalculate all per-unit costs from updated purchase data (with density and yield if provided)
    const unitCosts = calculateAllUnitCosts(
      insertIngredient.purchaseQuantity,
      insertIngredient.purchaseUnit as MeasurementUnit,
      insertIngredient.purchaseCost,
      insertIngredient.gramsPerMilliliter || undefined,
      insertIngredient.yieldPercentage ?? 97
    );
    
    const [updated] = await db
      .update(ingredients)
      .set({ 
        ...insertIngredient, 
        ...unitCosts,
        lastUpdated: new Date() 
      })
      .where(and(eq(ingredients.id, id), eq(ingredients.userId, userId)))
      .returning();

    if (!updated) return undefined;

    const affectedRecipeIds = await db
      .select({ recipeId: recipeIngredients.recipeId })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.ingredientId, id));

    for (const { recipeId } of affectedRecipeIds) {
      await this.recalculateRecipeCost(recipeId, userId);
    }

    return updated;
  }

  async deleteIngredient(id: string, userId: string): Promise<boolean> {
    // Delete all recipe ingredients using this ingredient (filtered by userId for security)
    // This prevents accidental deletion of other users' recipe ingredients if they share the same ingredient ID
    await db.delete(recipeIngredients).where(and(eq(recipeIngredients.ingredientId, id), eq(recipeIngredients.userId, userId)));
    
    const result = await db.delete(ingredients).where(and(eq(ingredients.id, id), eq(ingredients.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getRecipe(id: string, userId: string): Promise<Recipe | undefined> {
    const [recipe] = await db.select().from(recipes).where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
    return recipe || undefined;
  }

  async getRecipeWithIngredients(id: string, userId: string): Promise<RecipeWithIngredients | undefined> {
    const recipe = await this.getRecipe(id, userId);
    if (!recipe) return undefined;

    const recipeIngs = await this.getRecipeIngredients(id, userId);
    const subRecipes = await this.getRecipeSubIngredients(id, userId);
    return {
      ...recipe,
      ingredients: recipeIngs,
      subRecipes,
    };
  }

  async getAllRecipes(userId: string): Promise<Recipe[]> {
    return await db.select().from(recipes).where(eq(recipes.userId, userId));
  }

  async getAllRecipesWithIngredients(userId: string): Promise<RecipeWithIngredients[]> {
    const allRecipes = await this.getAllRecipes(userId);
    const results: RecipeWithIngredients[] = [];
    
    for (const recipe of allRecipes) {
      const recipeIngs = await this.getRecipeIngredients(recipe.id, userId);
      const subRecipes = await this.getRecipeSubIngredients(recipe.id, userId);
      results.push({
        ...recipe,
        ingredients: recipeIngs,
        subRecipes,
      });
    }
    
    return results;
  }

  async createRecipe(insertRecipe: InsertRecipe, userId: string): Promise<Recipe> {
    const [recipe] = await db
      .insert(recipes)
      .values({
        ...insertRecipe,
        userId,
      })
      .returning();
    return recipe;
  }

  async updateRecipe(id: string, insertRecipe: InsertRecipe, userId: string): Promise<Recipe | undefined> {
    const [updated] = await db
      .update(recipes)
      .set(insertRecipe)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning();

    if (!updated) return undefined;
    await this.recalculateRecipeCost(id, userId);
    return await this.getRecipe(id, userId);
  }

  async updateRecipePricing(id: string, pricing: UpdateRecipePricing, userId: string): Promise<Recipe | undefined> {
    const updateData: Partial<Recipe> = {};
    if (pricing.wastePercentage !== undefined) updateData.wastePercentage = pricing.wastePercentage;
    if (pricing.targetMargin !== undefined) updateData.targetMargin = pricing.targetMargin;
    if (pricing.consumablesBuffer !== undefined) updateData.consumablesBuffer = pricing.consumablesBuffer;
    if (pricing.menuPrice !== undefined) updateData.menuPrice = pricing.menuPrice;
    
    if (Object.keys(updateData).length === 0) return undefined;
    
    const [updated] = await db
      .update(recipes)
      .set(updateData)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning();
    
    return updated || undefined;
  }

  async updateRecipeCategory(id: string, category: string, userId: string): Promise<Recipe | undefined> {
    const [updated] = await db
      .update(recipes)
      .set({ category })
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning();
    
    return updated || undefined;
  }

  async updateRecipeName(id: string, name: string, userId: string): Promise<Recipe | undefined> {
    if (!name || !name.trim()) {
      return undefined;
    }
    const [updated] = await db
      .update(recipes)
      .set({ name: name.trim() })
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning();
    
    return updated || undefined;
  }

  async updateRecipePackagingPreset(id: string, isPackagingPreset: boolean, userId: string): Promise<Recipe | undefined> {
    const [updated] = await db
      .update(recipes)
      .set({ isPackagingPreset })
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning();
    
    return updated || undefined;
  }

  async duplicateRecipe(id: string, newName: string, userId: string): Promise<RecipeWithIngredients | undefined> {
    const original = await this.getRecipeWithIngredients(id, userId);
    if (!original) return undefined;

    const newRecipe = await this.createRecipe({
      name: newName,
      description: original.description,
      category: original.category,
      servings: original.servings,
      menuPrice: original.menuPrice,
      wastePercentage: original.wastePercentage,
      targetMargin: original.targetMargin,
      consumablesBuffer: original.consumablesBuffer,
      isPackagingPreset: original.isPackagingPreset,
    }, userId);

    for (const ri of original.ingredients) {
      await this.createRecipeIngredient({
        recipeId: newRecipe.id,
        ingredientId: ri.ingredientId,
        quantity: ri.quantity,
        unit: ri.unit,
      }, userId);
    }

    if (original.subRecipes) {
      for (const si of original.subRecipes) {
        await this.createRecipeSubIngredient({
          recipeId: newRecipe.id,
          subRecipeId: si.subRecipeId,
          quantity: si.quantity,
        }, userId);
      }
    }

    return await this.getRecipeWithIngredients(newRecipe.id, userId);
  }

  async deleteRecipe(id: string, userId: string): Promise<boolean> {
    // Delete recipe ingredients (cascade delete will handle this, but being explicit for security)
    await db.delete(recipeIngredients).where(and(eq(recipeIngredients.recipeId, id), eq(recipeIngredients.userId, userId)));
    // Delete sub-recipe relationships where this recipe is either the parent or the child
    await db.delete(recipeSubIngredients).where(and(eq(recipeSubIngredients.recipeId, id), eq(recipeSubIngredients.userId, userId)));
    await db.delete(recipeSubIngredients).where(and(eq(recipeSubIngredients.subRecipeId, id), eq(recipeSubIngredients.userId, userId)));
    const result = await db.delete(recipes).where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async recalculateRecipeCost(recipeId: string, userId: string): Promise<Recipe | undefined> {
    try {
      const recipe = await this.getRecipe(recipeId, userId);
      if (!recipe) return undefined;

      const recipeIngs = await this.getRecipeIngredients(recipeId, userId);
      
      let totalCost = 0;
      for (const ri of recipeIngs) {
        try {
          const ingredientCost = this.calculateIngredientCost(
            ri.ingredientDetails,
            ri.quantity,
            ri.unit
          );
          if (typeof ingredientCost === 'number' && !isNaN(ingredientCost)) {
            totalCost += ingredientCost;
          } else {
            console.warn(`Invalid cost calculation for ingredient ${ri.ingredientDetails.name}: ${ingredientCost}`);
          }
        } catch (err) {
          console.error(`Error calculating cost for ingredient ${ri.ingredientDetails.name}:`, err);
        }
      }

      const subRecipes = await this.getRecipeSubIngredients(recipeId, userId);
      for (const si of subRecipes) {
        try {
          const subRecipeCost = si.subRecipeDetails.costPerServing * si.quantity;
          if (typeof subRecipeCost === 'number' && !isNaN(subRecipeCost)) {
            totalCost += subRecipeCost;
          } else {
            console.warn(`Invalid cost calculation for sub-recipe ${si.subRecipeDetails.name}: ${subRecipeCost}`);
          }
        } catch (err) {
          console.error(`Error calculating cost for sub-recipe ${si.subRecipeDetails.name}:`, err);
        }
      }

      const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : 0;

      const [updated] = await db
        .update(recipes)
        .set({ totalCost, costPerServing })
        .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)))
        .returning();

      return updated;
    } catch (error) {
      console.error(`Error recalculating recipe cost for recipe ${recipeId}:`, error);
      throw error;
    }
  }

  private calculateIngredientCost(
    ingredient: Ingredient,
    recipeQuantity: number,
    recipeUnit: string
  ): number {
    try {
      // Validate inputs
      if (!ingredient || recipeQuantity <= 0 || !recipeUnit) {
        return 0;
      }

      // Get the appropriate cost per unit based on the recipe unit
      const costPerUnitMap: Record<string, number | null> = {
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
            recipeUnit as MeasurementUnit,
            options
          );
          
          // Still null means incompatible units or missing density for cross-family conversion
          if (costPerUnit === null) {
            const purchaseFamily = ingredient.purchaseUnit;
            const targetFamily = recipeUnit;
            if (!ingredient.gramsPerMilliliter) {
              console.warn(
                `Cross-family conversion from ${purchaseFamily} to ${targetFamily} requires density for ingredient ${ingredient.name}. Add density to enable accurate cost calculation.`
              );
            } else {
              console.warn(
                `Cannot convert between ${purchaseFamily} and ${targetFamily} for ingredient ${ingredient.name}`
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
      
      const cost = recipeQuantity * (costPerUnit || 0);
      
      // Guard against NaN or infinity
      if (!isFinite(cost)) {
        console.warn(`Invalid cost calculation result for ${ingredient.name}: ${cost}`);
        return 0;
      }
      
      return cost;
    } catch (error) {
      console.error(`Error in calculateIngredientCost for ingredient:`, error);
      return 0;
    }
  }

  async getRecipeIngredients(recipeId: string, userId: string): Promise<Array<RecipeIngredient & { ingredientDetails: Ingredient }>> {
    const recipeIngs = await db
      .select()
      .from(recipeIngredients)
      .where(and(eq(recipeIngredients.recipeId, recipeId), eq(recipeIngredients.userId, userId)));

    const result = [];
    for (const ri of recipeIngs) {
      const ingredient = await this.getIngredient(ri.ingredientId, userId);
      if (ingredient) {
        result.push({
          ...ri,
          ingredientDetails: ingredient,
        });
      }
    }
    return result;
  }

  async createRecipeIngredient(insertRecipeIngredient: InsertRecipeIngredient, userId: string): Promise<RecipeIngredient> {
    const [recipeIngredient] = await db
      .insert(recipeIngredients)
      .values({
        ...insertRecipeIngredient,
        userId,
      })
      .returning();
    
    await this.recalculateRecipeCost(insertRecipeIngredient.recipeId, userId);
    return recipeIngredient;
  }

  async updateRecipeIngredientQuantity(id: string, quantity: number, userId: string): Promise<RecipeIngredient | undefined> {
    const [updated] = await db
      .update(recipeIngredients)
      .set({ quantity })
      .where(and(eq(recipeIngredients.id, id), eq(recipeIngredients.userId, userId)))
      .returning();

    if (!updated) return undefined;
    await this.recalculateRecipeCost(updated.recipeId, userId);
    return updated;
  }

  async updateRecipeIngredient(id: string, updates: { quantity?: number; unit?: string }, userId: string): Promise<RecipeIngredient | undefined> {
    const updateData: any = {};
    if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
    if (updates.unit !== undefined) updateData.unit = updates.unit;
    
    if (Object.keys(updateData).length === 0) return undefined;
    
    const [updated] = await db
      .update(recipeIngredients)
      .set(updateData)
      .where(and(eq(recipeIngredients.id, id), eq(recipeIngredients.userId, userId)))
      .returning();

    if (!updated) return undefined;
    await this.recalculateRecipeCost(updated.recipeId, userId);
    return updated;
  }

  async deleteRecipeIngredient(id: string, userId: string): Promise<boolean> {
    const [recipeIngredient] = await db
      .select()
      .from(recipeIngredients)
      .where(and(eq(recipeIngredients.id, id), eq(recipeIngredients.userId, userId)));
    
    if (!recipeIngredient) return false;
    
    const result = await db.delete(recipeIngredients).where(and(eq(recipeIngredients.id, id), eq(recipeIngredients.userId, userId)));
    if (result.rowCount && result.rowCount > 0) {
      await this.recalculateRecipeCost(recipeIngredient.recipeId, userId);
      return true;
    }
    return false;
  }

  async getRecipeSubIngredients(recipeId: string, userId: string): Promise<Array<RecipeSubIngredient & { subRecipeDetails: Recipe }>> {
    const subIngs = await db
      .select()
      .from(recipeSubIngredients)
      .where(and(eq(recipeSubIngredients.recipeId, recipeId), eq(recipeSubIngredients.userId, userId)));

    const result = [];
    for (const si of subIngs) {
      const subRecipe = await this.getRecipe(si.subRecipeId, userId);
      if (subRecipe) {
        result.push({
          ...si,
          subRecipeDetails: subRecipe,
        });
      }
    }
    return result;
  }

  async createRecipeSubIngredient(insertSubIngredient: InsertRecipeSubIngredient, userId: string): Promise<RecipeSubIngredient> {
    const [subIngredient] = await db
      .insert(recipeSubIngredients)
      .values({
        ...insertSubIngredient,
        userId,
      })
      .returning();
    
    await this.recalculateRecipeCost(insertSubIngredient.recipeId, userId);
    return subIngredient;
  }

  async updateRecipeSubIngredientQuantity(id: string, quantity: number, userId: string): Promise<RecipeSubIngredient | undefined> {
    const [updated] = await db
      .update(recipeSubIngredients)
      .set({ quantity })
      .where(and(eq(recipeSubIngredients.id, id), eq(recipeSubIngredients.userId, userId)))
      .returning();

    if (!updated) return undefined;
    await this.recalculateRecipeCost(updated.recipeId, userId);
    return updated;
  }

  async deleteRecipeSubIngredient(id: string, userId: string): Promise<boolean> {
    const [subIngredient] = await db
      .select()
      .from(recipeSubIngredients)
      .where(and(eq(recipeSubIngredients.id, id), eq(recipeSubIngredients.userId, userId)));
    
    if (!subIngredient) return false;
    
    const result = await db.delete(recipeSubIngredients).where(and(eq(recipeSubIngredients.id, id), eq(recipeSubIngredients.userId, userId)));
    if (result.rowCount && result.rowCount > 0) {
      await this.recalculateRecipeCost(subIngredient.recipeId, userId);
      return true;
    }
    return false;
  }

  async checkCircularDependency(recipeId: string, subRecipeId: string, userId: string): Promise<boolean> {
    if (recipeId === subRecipeId) return true;
    
    const visited = new Set<string>();
    const queue = [subRecipeId];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (currentId === recipeId) return true;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const subIngs = await db
        .select({ subRecipeId: recipeSubIngredients.subRecipeId })
        .from(recipeSubIngredients)
        .where(and(eq(recipeSubIngredients.recipeId, currentId), eq(recipeSubIngredients.userId, userId)));
      
      for (const { subRecipeId: childId } of subIngs) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }
    
    return false;
  }

  async getAISettings(userId: string): Promise<AISettingsData | undefined> {
    const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.userId, userId));
    return settings || undefined;
  }

  async saveAISettings(insertSettings: InsertAISettings, userId: string): Promise<AISettingsData> {
    const [updated] = await db
      .insert(aiSettings)
      .values({
        ...insertSettings,
        userId,
      })
      .onConflictDoUpdate({
        target: aiSettings.userId,
        set: {
          aiProvider: insertSettings.aiProvider,
          huggingfaceToken: insertSettings.huggingfaceToken,
          updatedAt: new Date(),
        },
      })
      .returning();
    return updated;
  }

  async getAllDensityHeuristics(): Promise<DensityHeuristic[]> {
    return await db.select().from(densityHeuristics);
  }

  async updateDensityHeuristic(id: string, updates: Partial<InsertDensityHeuristic>): Promise<DensityHeuristic | undefined> {
    const [updated] = await db
      .update(densityHeuristics)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(eq(densityHeuristics.id, id))
      .returning();
    return updated || undefined;
  }

  async createDensityHeuristic(heuristic: InsertDensityHeuristic): Promise<DensityHeuristic> {
    const [created] = await db
      .insert(densityHeuristics)
      .values(heuristic)
      .returning();
    return created;
  }

  async getCategoryPricingSettings(userId: string): Promise<CategoryPricingSettings[]> {
    return await db.select().from(categoryPricingSettings).where(eq(categoryPricingSettings.userId, userId));
  }

  async getCategoryPricingSetting(userId: string, category: RecipeCategory): Promise<CategoryPricingSettings | undefined> {
    const [setting] = await db.select().from(categoryPricingSettings).where(
      and(eq(categoryPricingSettings.userId, userId), eq(categoryPricingSettings.category, category))
    );
    return setting || undefined;
  }

  async upsertCategoryPricingSetting(settings: InsertCategoryPricingSettings, userId: string): Promise<CategoryPricingSettings> {
    const existing = await this.getCategoryPricingSetting(userId, settings.category as RecipeCategory);
    
    if (existing) {
      const [updated] = await db
        .update(categoryPricingSettings)
        .set({
          wastePercentage: settings.wastePercentage,
          targetMargin: settings.targetMargin,
          updatedAt: new Date(),
        })
        .where(and(eq(categoryPricingSettings.userId, userId), eq(categoryPricingSettings.category, settings.category)))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(categoryPricingSettings)
        .values({
          ...settings,
          userId,
        })
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
