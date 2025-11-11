import {
  type Ingredient,
  type InsertIngredient,
  type Recipe,
  type InsertRecipe,
  type RecipeIngredient,
  type InsertRecipeIngredient,
  type RecipeWithIngredients,
  ingredients,
  recipes,
  recipeIngredients,
} from "@shared/schema";
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
    const [ingredient] = await db
      .insert(ingredients)
      .values(insertIngredient)
      .returning();
    return ingredient;
  }

  async updateIngredient(id: string, insertIngredient: InsertIngredient): Promise<Ingredient | undefined> {
    const [updated] = await db
      .update(ingredients)
      .set({ ...insertIngredient, lastUpdated: new Date() })
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
    const convertedQuantity = this.convertUnits(
      recipeQuantity,
      recipeUnit,
      ingredient.unit
    );
    return (convertedQuantity / ingredient.quantity) * ingredient.costPerUnit;
  }

  private convertUnits(quantity: number, fromUnit: string, toUnit: string): number {
    if (fromUnit === toUnit) return quantity;
    if (fromUnit === "units" || toUnit === "units") return quantity;

    const conversionToGrams: Record<string, number> = {
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

    const grams = quantity * (conversionToGrams[fromUnit] || 1);
    return grams / (conversionToGrams[toUnit] || 1);
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
