import {
  type Ingredient,
  type InsertIngredient,
  type Recipe,
  type InsertRecipe,
  type RecipeIngredient,
  type InsertRecipeIngredient,
  type RecipeWithIngredients,
  type MeasurementUnit,
  ingredients,
  recipes,
  recipeIngredients,
} from "@shared/schema";
import { calculateAllUnitCosts, calculateCostPerUnit } from "@shared/cost-calculator";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getIngredient(id: string): Promise<Ingredient | undefined>;
  getAllIngredients(): Promise<Ingredient[]>;
  createIngredient(ingredient: InsertIngredient): Promise<Ingredient>;
  updateIngredient(id: string, ingredient: InsertIngredient): Promise<Ingredient | undefined>;
  deleteIngredient(id: string): Promise<boolean>;
  
  getRecipe(id: string): Promise<Recipe | undefined>;
  getRecipeWithIngredients(id: string): Promise<RecipeWithIngredients | undefined>;
  getAllRecipes(): Promise<Recipe[]>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: string, recipe: InsertRecipe): Promise<Recipe | undefined>;
  deleteRecipe(id: string): Promise<boolean>;
  recalculateRecipeCost(recipeId: string): Promise<Recipe | undefined>;
  
  getRecipeIngredients(recipeId: string): Promise<Array<RecipeIngredient & { ingredientDetails: Ingredient }>>;
  createRecipeIngredient(recipeIngredient: InsertRecipeIngredient): Promise<RecipeIngredient>;
  updateRecipeIngredientQuantity(id: string, quantity: number): Promise<RecipeIngredient | undefined>;
  deleteRecipeIngredient(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getIngredient(id: string): Promise<Ingredient | undefined> {
    const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, id));
    return ingredient || undefined;
  }

  async getAllIngredients(): Promise<Ingredient[]> {
    return await db.select().from(ingredients);
  }

  async createIngredient(insertIngredient: InsertIngredient): Promise<Ingredient> {
    // Calculate all per-unit costs from purchase data
    const unitCosts = calculateAllUnitCosts(
      insertIngredient.purchaseQuantity,
      insertIngredient.purchaseUnit as MeasurementUnit,
      insertIngredient.purchaseCost
    );
    
    const [ingredient] = await db
      .insert(ingredients)
      .values({
        ...insertIngredient,
        ...unitCosts,
      })
      .returning();
    return ingredient;
  }

  async updateIngredient(id: string, insertIngredient: InsertIngredient): Promise<Ingredient | undefined> {
    // Recalculate all per-unit costs from updated purchase data
    const unitCosts = calculateAllUnitCosts(
      insertIngredient.purchaseQuantity,
      insertIngredient.purchaseUnit as MeasurementUnit,
      insertIngredient.purchaseCost
    );
    
    const [updated] = await db
      .update(ingredients)
      .set({ 
        ...insertIngredient, 
        ...unitCosts,
        lastUpdated: new Date() 
      })
      .where(eq(ingredients.id, id))
      .returning();

    if (!updated) return undefined;

    const affectedRecipeIds = await db
      .select({ recipeId: recipeIngredients.recipeId })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.ingredientId, id));

    for (const { recipeId } of affectedRecipeIds) {
      await this.recalculateRecipeCost(recipeId);
    }

    return updated;
  }

  async deleteIngredient(id: string): Promise<boolean> {
    const result = await db.delete(ingredients).where(eq(ingredients.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getRecipe(id: string): Promise<Recipe | undefined> {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe || undefined;
  }

  async getRecipeWithIngredients(id: string): Promise<RecipeWithIngredients | undefined> {
    const recipe = await this.getRecipe(id);
    if (!recipe) return undefined;

    const recipeIngs = await this.getRecipeIngredients(id);
    return {
      ...recipe,
      ingredients: recipeIngs,
    };
  }

  async getAllRecipes(): Promise<Recipe[]> {
    return await db.select().from(recipes);
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const [recipe] = await db
      .insert(recipes)
      .values(insertRecipe)
      .returning();
    return recipe;
  }

  async updateRecipe(id: string, insertRecipe: InsertRecipe): Promise<Recipe | undefined> {
    const [updated] = await db
      .update(recipes)
      .set(insertRecipe)
      .where(eq(recipes.id, id))
      .returning();

    if (!updated) return undefined;
    await this.recalculateRecipeCost(id);
    return await this.getRecipe(id);
  }

  async deleteRecipe(id: string): Promise<boolean> {
    await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
    const result = await db.delete(recipes).where(eq(recipes.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async recalculateRecipeCost(recipeId: string): Promise<Recipe | undefined> {
    const recipe = await this.getRecipe(recipeId);
    if (!recipe) return undefined;

    const recipeIngs = await this.getRecipeIngredients(recipeId);
    
    const totalCost = recipeIngs.reduce((sum, ri) => {
      return sum + this.calculateIngredientCost(
        ri.ingredientDetails,
        ri.quantity,
        ri.unit
      );
    }, 0);

    const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : 0;

    const [updated] = await db
      .update(recipes)
      .set({ totalCost, costPerServing })
      .where(eq(recipes.id, recipeId))
      .returning();

    return updated;
  }

  private calculateIngredientCost(
    ingredient: Ingredient,
    recipeQuantity: number,
    recipeUnit: string
  ): number {
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
        // Use shared cost calculator to ensure consistency
        costPerUnit = calculateCostPerUnit(
          ingredient.purchaseQuantity,
          ingredient.purchaseUnit as MeasurementUnit,
          ingredient.purchaseCost,
          recipeUnit as MeasurementUnit
        );
        
        // Still null means incompatible units (e.g., "units" ↔ weight/volume)
        if (costPerUnit === null) {
          console.warn(
            `Cannot convert between ${ingredient.purchaseUnit} and ${recipeUnit} for ingredient ${ingredient.name}`
          );
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

  async getRecipeIngredients(recipeId: string): Promise<Array<RecipeIngredient & { ingredientDetails: Ingredient }>> {
    const recipeIngs = await db
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipeId));

    const result = [];
    for (const ri of recipeIngs) {
      const ingredient = await this.getIngredient(ri.ingredientId);
      if (ingredient) {
        result.push({
          ...ri,
          ingredientDetails: ingredient,
        });
      }
    }
    return result;
  }

  async createRecipeIngredient(insertRecipeIngredient: InsertRecipeIngredient): Promise<RecipeIngredient> {
    const [recipeIngredient] = await db
      .insert(recipeIngredients)
      .values(insertRecipeIngredient)
      .returning();
    
    await this.recalculateRecipeCost(insertRecipeIngredient.recipeId);
    return recipeIngredient;
  }

  async updateRecipeIngredientQuantity(id: string, quantity: number): Promise<RecipeIngredient | undefined> {
    const [updated] = await db
      .update(recipeIngredients)
      .set({ quantity })
      .where(eq(recipeIngredients.id, id))
      .returning();

    if (!updated) return undefined;
    await this.recalculateRecipeCost(updated.recipeId);
    return updated;
  }

  async deleteRecipeIngredient(id: string): Promise<boolean> {
    const [recipeIngredient] = await db
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.id, id));
    
    if (!recipeIngredient) return false;
    
    const result = await db.delete(recipeIngredients).where(eq(recipeIngredients.id, id));
    if (result.rowCount && result.rowCount > 0) {
      await this.recalculateRecipeCost(recipeIngredient.recipeId);
      return true;
    }
    return false;
  }
}

export const storage = new DatabaseStorage();
