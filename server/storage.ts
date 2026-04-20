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
  type WasteLog,
  type InsertWasteLog,
  type WasteLogWithIngredient,
  type InventoryCount,
  type InsertInventoryCount,
  type StorageType,
  type AiUsage,
  type SubscriptionTier,
  type DashboardConfig,
  type InsertDashboardConfig,
  type ManagedPricingSubscription,
  type InsertManagedPricingSubscription,
  type ManagedPricingTier,
  type PricingSnapshot,
  type InsertPricingSnapshot,
  type Employee,
  type InsertEmployee,
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderItem,
  type InsertPurchaseOrderItem,
  type PurchaseOrderWithItems,
  type PriceHistory,
  type InsertPriceHistory,
  type RecipeSales,
  type InsertRecipeSales,
  subscriptionTiers,
  ingredients,
  recipes,
  recipeIngredients,
  recipeSubIngredients,
  aiSettings,
  users,
  densityHeuristics,
  categoryPricingSettings,
  wasteLogs,
  inventoryCounts,
  aiUsage,
  dashboardConfigs,
  managedPricingSubscriptions,
  pricingSnapshots,
  employees,
  purchaseOrders,
  purchaseOrderItems,
  priceHistory,
  recipeSales,
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
  updateRecipeBaseRecipe(id: string, isBaseRecipe: boolean, userId: string): Promise<Recipe | undefined>;
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
  
  // Waste log operations
  createWasteLog(wasteLog: InsertWasteLog, userId: string): Promise<WasteLog>;
  getWasteLogs(userId: string, limit?: number): Promise<WasteLogWithIngredient[]>;
  getWasteLogsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<WasteLogWithIngredient[]>;
  deleteWasteLog(id: string, userId: string): Promise<boolean>;
  
  // Inventory operations
  updateIngredientStock(ingredientId: string, currentStock: number, userId: string): Promise<Ingredient | undefined>;
  updateIngredientInventorySettings(ingredientId: string, settings: { parValue?: number; storageType?: string; countFrequency?: string }, userId: string): Promise<Ingredient | undefined>;
  getIngredientsByStorageType(userId: string, storageType: StorageType): Promise<Ingredient[]>;
  recordInventoryCount(count: InsertInventoryCount, userId: string): Promise<InventoryCount>;
  getInventoryCounts(userId: string, limit?: number): Promise<InventoryCount[]>;
  
  // Subscription and billing operations
  updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    subscriptionTier?: string;
    subscriptionStatus?: string;
    subscriptionCurrentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
  }): Promise<User | undefined>;
  startFreeTrial(userId: string): Promise<User | undefined>;
  
  // AI Usage tracking
  getOrCreateAiUsage(userId: string): Promise<AiUsage>;
  incrementAiUsage(userId: string): Promise<AiUsage>;
  getAiUsageRemaining(userId: string): Promise<{ used: number; limit: number; remaining: number }>;
  canUseAi(userId: string): Promise<boolean>;
  resetAiUsageForNewPeriod(userId: string, periodStart: Date, periodEnd: Date): Promise<AiUsage>;
  
  // Dashboard configuration operations
  getDashboardConfigs(userId: string): Promise<DashboardConfig[]>;
  getDashboardConfig(id: string, userId: string): Promise<DashboardConfig | undefined>;
  createDashboardConfig(config: InsertDashboardConfig, userId: string): Promise<DashboardConfig>;
  updateDashboardConfig(id: string, config: Partial<InsertDashboardConfig>, userId: string): Promise<DashboardConfig | undefined>;
  deleteDashboardConfig(id: string, userId: string): Promise<boolean>;
  reorderDashboardConfigs(userId: string, orderedIds: string[]): Promise<DashboardConfig[]>;
  createDefaultDashboardConfigs(userId: string): Promise<DashboardConfig[]>;
  
  // Managed Pricing Add-on operations
  getManagedPricingSubscription(userId: string): Promise<ManagedPricingSubscription | undefined>;
  getAllManagedPricingSubscriptions(): Promise<(ManagedPricingSubscription & { user: User })[]>;
  createManagedPricingSubscription(subscription: InsertManagedPricingSubscription, userId: string): Promise<ManagedPricingSubscription>;
  updateManagedPricingSubscription(userId: string, updates: Partial<ManagedPricingSubscription>): Promise<ManagedPricingSubscription | undefined>;
  cancelManagedPricingSubscription(userId: string): Promise<ManagedPricingSubscription | undefined>;
  
  // Pricing Snapshot operations
  getPricingSnapshots(userId: string): Promise<PricingSnapshot[]>;
  getPricingSnapshot(id: string, userId: string): Promise<PricingSnapshot | undefined>;
  createPricingSnapshot(snapshot: InsertPricingSnapshot, userId: string): Promise<PricingSnapshot>;
  deletePricingSnapshot(id: string, userId: string): Promise<boolean>;
  applyPricingSnapshot(id: string, userId: string): Promise<{ updatedRecipes: number; updatedCategories: number }>;

  // Employee operations (business tier)
  getEmployees(userId: string): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee, userId: string): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>, userId: string): Promise<Employee | undefined>;
  deleteEmployee(id: string, userId: string): Promise<boolean>;

  // Purchase Order operations
  getPurchaseOrders(userId: string): Promise<PurchaseOrder[]>;
  getPurchaseOrderWithItems(orderId: string, userId: string): Promise<PurchaseOrderWithItems | undefined>;
  createPurchaseOrder(order: InsertPurchaseOrder, userId: string): Promise<PurchaseOrder>;
  updatePurchaseOrderStatus(orderId: string, status: string, userId: string): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(orderId: string, userId: string): Promise<boolean>;
  addPurchaseOrderItem(orderId: string, item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  removePurchaseOrderItem(itemId: string): Promise<boolean>;

  // Price History operations
  getPriceHistory(ingredientId: string): Promise<PriceHistory[]>;
  recordPriceSnapshot(ingredient: Ingredient, userId: string): Promise<PriceHistory>;

  // Recipe Sales operations
  getRecipeSales(recipeId: string, weeks?: number): Promise<RecipeSales[]>;
  upsertWeeklySales(data: InsertRecipeSales): Promise<RecipeSales>;
  getMenuEngineeringData(userId: string): Promise<Array<{
    recipeId: string;
    recipeName: string;
    avgWeeklyUnits: number;
    totalRevenue: number;
    contributionMargin: number;
    classification: "star" | "puzzle" | "plowhorse" | "dog";
  }>>;
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

  async updateRecipeBaseRecipe(id: string, isBaseRecipe: boolean, userId: string): Promise<Recipe | undefined> {
    const [updated] = await db
      .update(recipes)
      .set({ isBaseRecipe })
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
      isBaseRecipe: original.isBaseRecipe,
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

  // Waste log operations
  async createWasteLog(wasteLog: InsertWasteLog, userId: string): Promise<WasteLog> {
    const [created] = await db
      .insert(wasteLogs)
      .values({
        ...wasteLog,
        userId,
      })
      .returning();
    return created;
  }

  async getWasteLogs(userId: string, limit = 100): Promise<WasteLogWithIngredient[]> {
    const logs = await db
      .select()
      .from(wasteLogs)
      .where(eq(wasteLogs.userId, userId))
      .orderBy(wasteLogs.wastedAt)
      .limit(limit);
    
    const result: WasteLogWithIngredient[] = [];
    for (const log of logs) {
      const ingredient = await this.getIngredient(log.ingredientId, userId);
      if (ingredient) {
        result.push({
          ...log,
          ingredient,
        });
      }
    }
    return result;
  }

  async getWasteLogsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<WasteLogWithIngredient[]> {
    const logs = await db
      .select()
      .from(wasteLogs)
      .where(eq(wasteLogs.userId, userId))
      .orderBy(wasteLogs.wastedAt);
    
    // Filter by date range
    const filtered = logs.filter(log => {
      const wastedAt = new Date(log.wastedAt);
      return wastedAt >= startDate && wastedAt <= endDate;
    });
    
    const result: WasteLogWithIngredient[] = [];
    for (const log of filtered) {
      const ingredient = await this.getIngredient(log.ingredientId, userId);
      if (ingredient) {
        result.push({
          ...log,
          ingredient,
        });
      }
    }
    return result;
  }

  async deleteWasteLog(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(wasteLogs).where(and(eq(wasteLogs.id, id), eq(wasteLogs.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Inventory operations
  async updateIngredientStock(ingredientId: string, currentStock: number, userId: string): Promise<Ingredient | undefined> {
    const [updated] = await db
      .update(ingredients)
      .set({ 
        currentStock,
        lastCountDate: new Date(),
        lastUpdated: new Date(),
      })
      .where(and(eq(ingredients.id, ingredientId), eq(ingredients.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async updateIngredientInventorySettings(
    ingredientId: string, 
    settings: { parValue?: number; storageType?: string; countFrequency?: string }, 
    userId: string
  ): Promise<Ingredient | undefined> {
    const updateData: any = { lastUpdated: new Date() };
    if (settings.parValue !== undefined) updateData.parValue = settings.parValue;
    if (settings.storageType !== undefined) updateData.storageType = settings.storageType;
    if (settings.countFrequency !== undefined) updateData.countFrequency = settings.countFrequency;

    const [updated] = await db
      .update(ingredients)
      .set(updateData)
      .where(and(eq(ingredients.id, ingredientId), eq(ingredients.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async getIngredientsByStorageType(userId: string, storageType: StorageType): Promise<Ingredient[]> {
    return await db
      .select()
      .from(ingredients)
      .where(and(eq(ingredients.userId, userId), eq(ingredients.storageType, storageType)));
  }

  async recordInventoryCount(count: InsertInventoryCount, userId: string): Promise<InventoryCount> {
    const [created] = await db
      .insert(inventoryCounts)
      .values({
        ...count,
        userId,
      })
      .returning();
    return created;
  }

  async getInventoryCounts(userId: string, limit = 50): Promise<InventoryCount[]> {
    return await db
      .select()
      .from(inventoryCounts)
      .where(eq(inventoryCounts.userId, userId))
      .orderBy(inventoryCounts.countedAt)
      .limit(limit);
  }

  // Subscription and billing operations
  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    subscriptionTier?: string;
    subscriptionStatus?: string;
    subscriptionCurrentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
  }): Promise<User | undefined> {
    const updateData: any = { updatedAt: new Date() };
    if (stripeInfo.stripeCustomerId !== undefined) updateData.stripeCustomerId = stripeInfo.stripeCustomerId;
    if (stripeInfo.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = stripeInfo.stripeSubscriptionId;
    if (stripeInfo.subscriptionTier !== undefined) updateData.subscriptionTier = stripeInfo.subscriptionTier;
    if (stripeInfo.subscriptionStatus !== undefined) updateData.subscriptionStatus = stripeInfo.subscriptionStatus;
    if (stripeInfo.subscriptionCurrentPeriodEnd !== undefined) updateData.subscriptionCurrentPeriodEnd = stripeInfo.subscriptionCurrentPeriodEnd;
    if (stripeInfo.trialEndsAt !== undefined) updateData.trialEndsAt = stripeInfo.trialEndsAt;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  async startFreeTrial(userId: string): Promise<User | undefined> {
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const [updated] = await db
      .update(users)
      .set({
        subscriptionTier: 'trial',
        subscriptionStatus: 'trialing',
        trialEndsAt,
        updatedAt: now,
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (updated) {
      // Create initial AI usage record for trial period
      const periodStart = now;
      const periodEnd = trialEndsAt;
      await db.insert(aiUsage).values({
        userId,
        periodStart,
        periodEnd,
        queriesUsed: 0,
      });
    }
    
    return updated || undefined;
  }

  // AI Usage tracking
  async getOrCreateAiUsage(userId: string): Promise<AiUsage> {
    const now = new Date();
    
    // Find existing usage record for current period
    const [existing] = await db
      .select()
      .from(aiUsage)
      .where(eq(aiUsage.userId, userId))
      .orderBy(aiUsage.periodEnd);
    
    if (existing && new Date(existing.periodEnd) > now) {
      return existing;
    }
    
    // Get user subscription info
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Calculate period based on subscription
    let periodStart = now;
    let periodEnd: Date;
    
    if (user.subscriptionCurrentPeriodEnd) {
      periodEnd = new Date(user.subscriptionCurrentPeriodEnd);
    } else if (user.trialEndsAt) {
      periodEnd = new Date(user.trialEndsAt);
    } else {
      // Default to end of current month
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
    
    // Create new usage record
    const [created] = await db
      .insert(aiUsage)
      .values({
        userId,
        periodStart,
        periodEnd,
        queriesUsed: 0,
      })
      .returning();
    
    return created;
  }

  async incrementAiUsage(userId: string): Promise<AiUsage> {
    const usage = await this.getOrCreateAiUsage(userId);
    
    const [updated] = await db
      .update(aiUsage)
      .set({
        queriesUsed: usage.queriesUsed + 1,
        lastQueryAt: new Date(),
      })
      .where(eq(aiUsage.id, usage.id))
      .returning();
    
    return updated;
  }

  async getAiUsageRemaining(userId: string): Promise<{ used: number; limit: number; remaining: number }> {
    const user = await this.getUser(userId);
    if (!user) {
      return { used: 0, limit: 0, remaining: 0 };
    }
    
    const tier = (user.subscriptionTier as SubscriptionTier) || 'free';
    const tierConfig = subscriptionTiers[tier] || subscriptionTiers.free;
    const limit = tierConfig.aiQueriesPerMonth;
    
    // Check if subscription/trial is still valid
    const now = new Date();
    const isActive = user.subscriptionStatus === 'active' || 
      (user.subscriptionStatus === 'trialing' && user.trialEndsAt && new Date(user.trialEndsAt) > now);
    
    if (!isActive && tier !== 'free') {
      return { used: 0, limit: 0, remaining: 0 };
    }
    
    try {
      const usage = await this.getOrCreateAiUsage(userId);
      const used = usage.queriesUsed;
      const remaining = Math.max(0, limit - used);
      
      return { used, limit, remaining };
    } catch {
      return { used: 0, limit, remaining: limit };
    }
  }

  async canUseAi(userId: string): Promise<boolean> {
    const { remaining } = await this.getAiUsageRemaining(userId);
    return remaining > 0;
  }

  async resetAiUsageForNewPeriod(userId: string, periodStart: Date, periodEnd: Date): Promise<AiUsage> {
    // Delete old usage records
    await db.delete(aiUsage).where(eq(aiUsage.userId, userId));
    
    // Create new record
    const [created] = await db
      .insert(aiUsage)
      .values({
        userId,
        periodStart,
        periodEnd,
        queriesUsed: 0,
      })
      .returning();
    
    return created;
  }

  // Dashboard configuration methods
  async getDashboardConfigs(userId: string): Promise<DashboardConfig[]> {
    const configs = await db
      .select()
      .from(dashboardConfigs)
      .where(eq(dashboardConfigs.userId, userId));
    return configs.sort((a, b) => a.position - b.position);
  }

  async getDashboardConfig(id: string, userId: string): Promise<DashboardConfig | undefined> {
    const [config] = await db
      .select()
      .from(dashboardConfigs)
      .where(and(eq(dashboardConfigs.id, id), eq(dashboardConfigs.userId, userId)));
    return config || undefined;
  }

  async createDashboardConfig(config: InsertDashboardConfig, userId: string): Promise<DashboardConfig> {
    // Get next position
    const existing = await this.getDashboardConfigs(userId);
    const nextPosition = existing.length > 0 ? Math.max(...existing.map(c => c.position)) + 1 : 0;
    
    const [created] = await db
      .insert(dashboardConfigs)
      .values({
        ...config,
        position: config.position ?? nextPosition,
        userId,
      })
      .returning();
    return created;
  }

  async updateDashboardConfig(id: string, config: Partial<InsertDashboardConfig>, userId: string): Promise<DashboardConfig | undefined> {
    const [updated] = await db
      .update(dashboardConfigs)
      .set({ ...config, updatedAt: new Date() })
      .where(and(eq(dashboardConfigs.id, id), eq(dashboardConfigs.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async deleteDashboardConfig(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(dashboardConfigs)
      .where(and(eq(dashboardConfigs.id, id), eq(dashboardConfigs.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async reorderDashboardConfigs(userId: string, orderedIds: string[]): Promise<DashboardConfig[]> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(dashboardConfigs)
        .set({ position: i, updatedAt: new Date() })
        .where(and(eq(dashboardConfigs.id, orderedIds[i]), eq(dashboardConfigs.userId, userId)));
    }
    return this.getDashboardConfigs(userId);
  }

  async createDefaultDashboardConfigs(userId: string): Promise<DashboardConfig[]> {
    const defaultCharts = [
      { chartType: "most_expensive_recipes", position: 0, width: "half" as const },
      { chartType: "cost_efficient_recipes", position: 1, width: "half" as const },
      { chartType: "ingredients_by_category", position: 2, width: "half" as const },
      { chartType: "margin_analysis", position: 3, width: "half" as const },
    ];
    
    const created: DashboardConfig[] = [];
    for (const chart of defaultCharts) {
      const config = await this.createDashboardConfig(chart, userId);
      created.push(config);
    }
    return created;
  }

  // Managed Pricing Add-on methods
  async getManagedPricingSubscription(userId: string): Promise<ManagedPricingSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(managedPricingSubscriptions)
      .where(eq(managedPricingSubscriptions.userId, userId));
    return subscription || undefined;
  }

  async getAllManagedPricingSubscriptions(): Promise<(ManagedPricingSubscription & { user: User })[]> {
    const results = await db
      .select()
      .from(managedPricingSubscriptions)
      .innerJoin(users, eq(managedPricingSubscriptions.userId, users.id));
    
    return results.map(r => ({
      ...r.managed_pricing_subscriptions,
      user: r.users,
    }));
  }

  async createManagedPricingSubscription(subscription: InsertManagedPricingSubscription, userId: string): Promise<ManagedPricingSubscription> {
    const [created] = await db
      .insert(managedPricingSubscriptions)
      .values({
        ...subscription,
        userId,
      })
      .returning();
    return created;
  }

  async updateManagedPricingSubscription(userId: string, updates: Partial<ManagedPricingSubscription>): Promise<ManagedPricingSubscription | undefined> {
    const [updated] = await db
      .update(managedPricingSubscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(managedPricingSubscriptions.userId, userId))
      .returning();
    return updated || undefined;
  }

  async cancelManagedPricingSubscription(userId: string): Promise<ManagedPricingSubscription | undefined> {
    const [canceled] = await db
      .update(managedPricingSubscriptions)
      .set({ 
        status: "canceled", 
        canceledAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(managedPricingSubscriptions.userId, userId))
      .returning();
    return canceled || undefined;
  }

  // Pricing Snapshot methods
  async getPricingSnapshots(userId: string): Promise<PricingSnapshot[]> {
    const snapshots = await db
      .select()
      .from(pricingSnapshots)
      .where(eq(pricingSnapshots.userId, userId));
    return snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPricingSnapshot(id: string, userId: string): Promise<PricingSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(pricingSnapshots)
      .where(and(eq(pricingSnapshots.id, id), eq(pricingSnapshots.userId, userId)));
    return snapshot || undefined;
  }

  async createPricingSnapshot(snapshot: InsertPricingSnapshot, userId: string): Promise<PricingSnapshot> {
    // Enforce limit of 2 snapshots per user
    const existing = await this.getPricingSnapshots(userId);
    if (existing.length >= 2) {
      // Delete the oldest snapshot
      const oldest = existing[existing.length - 1];
      await this.deletePricingSnapshot(oldest.id, userId);
    }

    const [created] = await db
      .insert(pricingSnapshots)
      .values({
        ...snapshot,
        userId,
      })
      .returning();
    return created;
  }

  async deletePricingSnapshot(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(pricingSnapshots)
      .where(and(eq(pricingSnapshots.id, id), eq(pricingSnapshots.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async applyPricingSnapshot(id: string, userId: string): Promise<{ updatedRecipes: number; updatedCategories: number }> {
    const snapshot = await this.getPricingSnapshot(id, userId);
    if (!snapshot) {
      throw new Error("Snapshot not found");
    }

    let updatedRecipes = 0;
    let updatedCategories = 0;

    // Apply recipe pricing
    const recipePricingData = snapshot.recipePricing as Array<{
      recipeId: string;
      menuPrice: number | null;
      wastePercentage: number;
      targetMargin: number;
      consumablesBuffer: number;
    }>;

    for (const pricing of recipePricingData) {
      const result = await db
        .update(recipes)
        .set({
          menuPrice: pricing.menuPrice,
          wastePercentage: pricing.wastePercentage,
          targetMargin: pricing.targetMargin,
          consumablesBuffer: pricing.consumablesBuffer,
        })
        .where(and(eq(recipes.id, pricing.recipeId), eq(recipes.userId, userId)));
      
      if (result.rowCount && result.rowCount > 0) {
        updatedRecipes++;
      }
    }

    // Apply category settings
    const categorySettingsData = snapshot.categorySettings as Array<{
      category: string;
      wastePercentage: number;
      targetMargin: number;
    }>;

    for (const setting of categorySettingsData) {
      await this.upsertCategoryPricingSetting({
        category: setting.category as RecipeCategory,
        wastePercentage: setting.wastePercentage,
        targetMargin: setting.targetMargin,
      }, userId);
      updatedCategories++;
    }

    return { updatedRecipes, updatedCategories };
  }

  // Employee operations (business tier)
  async getEmployees(userId: string): Promise<Employee[]> {
    return await db.select().from(employees)
      .where(eq(employees.userId, userId))
      .orderBy(employees.name);
  }

  async createEmployee(employee: InsertEmployee, userId: string): Promise<Employee> {
    const [created] = await db
      .insert(employees)
      .values({ ...employee, userId })
      .returning();
    return created;
  }

  async updateEmployee(id: string, updates: Partial<InsertEmployee>, userId: string): Promise<Employee | undefined> {
    const [updated] = await db
      .update(employees)
      .set(updates)
      .where(and(eq(employees.id, id), eq(employees.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async deleteEmployee(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(employees)
      .where(and(eq(employees.id, id), eq(employees.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Purchase Order operations
  async getPurchaseOrders(userId: string): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders)
      .where(eq(purchaseOrders.userId, userId))
      .orderBy(purchaseOrders.createdAt);
  }

  async getPurchaseOrderWithItems(orderId: string, userId: string): Promise<PurchaseOrderWithItems | undefined> {
    const [order] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.userId, userId)));
    if (!order) return undefined;

    const items = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.orderId, orderId));

    const itemsWithIngredients = [];
    for (const item of items) {
      const ingredient = await this.getIngredient(item.ingredientId, userId);
      if (ingredient) {
        itemsWithIngredients.push({ ...item, ingredient });
      }
    }

    return { ...order, items: itemsWithIngredients };
  }

  async createPurchaseOrder(order: InsertPurchaseOrder, userId: string): Promise<PurchaseOrder> {
    const [created] = await db
      .insert(purchaseOrders)
      .values({ ...order, userId })
      .returning();
    return created;
  }

  async updatePurchaseOrderStatus(orderId: string, status: string, userId: string): Promise<PurchaseOrder | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (status === "submitted") updateData.submittedAt = new Date();

    const [updated] = await db
      .update(purchaseOrders)
      .set(updateData)
      .where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async deletePurchaseOrder(orderId: string, userId: string): Promise<boolean> {
    // Delete items first
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId));
    const result = await db
      .delete(purchaseOrders)
      .where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async addPurchaseOrderItem(orderId: string, item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [created] = await db
      .insert(purchaseOrderItems)
      .values({ ...item, orderId })
      .returning();

    // Update order total
    const items = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.orderId, orderId));
    const total = items.reduce((sum, i) => sum + (i.estimatedTotalCost || 0), 0);
    await db
      .update(purchaseOrders)
      .set({ totalEstimatedCost: total, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, orderId));

    return created;
  }

  async removePurchaseOrderItem(itemId: string): Promise<boolean> {
    const [item] = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, itemId));

    const result = await db
      .delete(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, itemId));

    if (item && result.rowCount && result.rowCount > 0) {
      // Update order total
      const items = await db
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.orderId, item.orderId));
      const total = items.reduce((sum, i) => sum + (i.estimatedTotalCost || 0), 0);
      await db
        .update(purchaseOrders)
        .set({ totalEstimatedCost: total, updatedAt: new Date() })
        .where(eq(purchaseOrders.id, item.orderId));
      return true;
    }
    return false;
  }

  // Price History operations
  async getPriceHistory(ingredientId: string): Promise<PriceHistory[]> {
    return await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.ingredientId, ingredientId))
      .orderBy(priceHistory.recordedAt);
  }

  async recordPriceSnapshot(ingredient: Ingredient, userId: string): Promise<PriceHistory> {
    const [record] = await db
      .insert(priceHistory)
      .values({
        ingredientId: ingredient.id,
        userId,
        purchaseCost: ingredient.purchaseCost,
        purchaseQuantity: ingredient.purchaseQuantity,
        purchaseUnit: ingredient.purchaseUnit,
        costPerGram: ingredient.costPerGram,
        store: ingredient.store,
      })
      .returning();
    return record;
  }

  // Recipe Sales operations
  async getRecipeSales(recipeId: string, weeks = 12): Promise<RecipeSales[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);

    return await db
      .select()
      .from(recipeSales)
      .where(and(
        eq(recipeSales.recipeId, recipeId),
      ))
      .orderBy(recipeSales.weekStartDate);
  }

  async upsertWeeklySales(data: InsertRecipeSales): Promise<RecipeSales> {
    // Check for existing record for same recipe + week
    const weekStart = new Date(data.weekStartDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [existing] = await db
      .select()
      .from(recipeSales)
      .where(and(
        eq(recipeSales.recipeId, data.recipeId),
      ));

    if (existing) {
      const [updated] = await db
        .update(recipeSales)
        .set({
          unitsSold: data.unitsSold,
          revenue: data.revenue,
          source: data.source,
        })
        .where(eq(recipeSales.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(recipeSales)
      .values(data)
      .returning();
    return created;
  }

  async getMenuEngineeringData(userId: string): Promise<Array<{
    recipeId: string;
    recipeName: string;
    avgWeeklyUnits: number;
    totalRevenue: number;
    contributionMargin: number;
    classification: "star" | "puzzle" | "plowhorse" | "dog";
  }>> {
    const allRecipes = await this.getAllRecipes(userId);
    const results = [];

    for (const recipe of allRecipes) {
      const sales = await this.getRecipeSales(recipe.id);
      if (sales.length === 0) continue;

      const totalUnits = sales.reduce((sum, s) => sum + s.unitsSold, 0);
      const totalRevenue = sales.reduce((sum, s) => sum + (s.revenue || 0), 0);
      const avgWeeklyUnits = totalUnits / sales.length;
      const contributionMargin = recipe.menuPrice
        ? (recipe.menuPrice - recipe.costPerServing)
        : 0;

      results.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        avgWeeklyUnits,
        totalRevenue,
        contributionMargin,
        classification: "star" as const, // placeholder, will compute below
      });
    }

    if (results.length === 0) return results;

    // Compute medians for quadrant boundaries
    const unitsSorted = [...results].sort((a, b) => a.avgWeeklyUnits - b.avgWeeklyUnits);
    const marginSorted = [...results].sort((a, b) => a.contributionMargin - b.contributionMargin);
    const medianUnits = unitsSorted[Math.floor(unitsSorted.length / 2)]?.avgWeeklyUnits || 0;
    const medianMargin = marginSorted[Math.floor(marginSorted.length / 2)]?.contributionMargin || 0;

    // Classify each item
    for (const item of results) {
      const highPopularity = item.avgWeeklyUnits >= medianUnits;
      const highMargin = item.contributionMargin >= medianMargin;

      if (highPopularity && highMargin) {
        item.classification = "star";
      } else if (!highPopularity && highMargin) {
        item.classification = "puzzle";
      } else if (highPopularity && !highMargin) {
        item.classification = "plowhorse";
      } else {
        item.classification = "dog";
      }
    }

    return results;
  }
}

export const storage = new DatabaseStorage();
