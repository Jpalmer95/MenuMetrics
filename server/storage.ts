import {
  type Ingredient,
  type InsertIngredient,
  type Recipe,
  type InsertRecipe,
  type RecipeIngredient,
  type InsertRecipeIngredient,
  type RecipeWithIngredients,
} from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private ingredients: Map<string, Ingredient>;
  private recipes: Map<string, Recipe>;
  private recipeIngredients: Map<string, RecipeIngredient>;

  constructor() {
    this.ingredients = new Map();
    this.recipes = new Map();
    this.recipeIngredients = new Map();
  }

  async getIngredient(id: string): Promise<Ingredient | undefined> {
    return this.ingredients.get(id);
  }

  async getAllIngredients(): Promise<Ingredient[]> {
    return Array.from(this.ingredients.values());
  }

  async createIngredient(insertIngredient: InsertIngredient): Promise<Ingredient> {
    const id = randomUUID();
    const ingredient: Ingredient = {
      ...insertIngredient,
      id,
      lastUpdated: new Date(),
    };
    this.ingredients.set(id, ingredient);
    return ingredient;
  }

  async updateIngredient(id: string, insertIngredient: InsertIngredient): Promise<Ingredient | undefined> {
    const existing = this.ingredients.get(id);
    if (!existing) return undefined;

    const updated: Ingredient = {
      ...insertIngredient,
      id,
      lastUpdated: new Date(),
    };
    this.ingredients.set(id, updated);

    const affectedRecipes = Array.from(this.recipeIngredients.values())
      .filter((ri) => ri.ingredientId === id)
      .map((ri) => ri.recipeId);

    for (const recipeId of new Set(affectedRecipes)) {
      await this.recalculateRecipeCost(recipeId);
    }

    return updated;
  }

  async deleteIngredient(id: string): Promise<boolean> {
    return this.ingredients.delete(id);
  }

  async getRecipe(id: string): Promise<Recipe | undefined> {
    return this.recipes.get(id);
  }

  async getRecipeWithIngredients(id: string): Promise<RecipeWithIngredients | undefined> {
    const recipe = this.recipes.get(id);
    if (!recipe) return undefined;

    const ingredients = await this.getRecipeIngredients(id);
    return {
      ...recipe,
      ingredients,
    };
  }

  async getAllRecipes(): Promise<Recipe[]> {
    return Array.from(this.recipes.values());
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const id = randomUUID();
    const recipe: Recipe = {
      ...insertRecipe,
      id,
      totalCost: 0,
      costPerServing: 0,
      createdAt: new Date(),
    };
    this.recipes.set(id, recipe);
    return recipe;
  }

  async updateRecipe(id: string, insertRecipe: InsertRecipe): Promise<Recipe | undefined> {
    const existing = this.recipes.get(id);
    if (!existing) return undefined;

    const updated: Recipe = {
      ...existing,
      ...insertRecipe,
    };
    this.recipes.set(id, updated);
    await this.recalculateRecipeCost(id);
    return this.recipes.get(id);
  }

  async deleteRecipe(id: string): Promise<boolean> {
    const recipeIngs = Array.from(this.recipeIngredients.values())
      .filter((ri) => ri.recipeId === id);
    
    recipeIngs.forEach((ri) => this.recipeIngredients.delete(ri.id));
    
    return this.recipes.delete(id);
  }

  async recalculateRecipeCost(recipeId: string): Promise<Recipe | undefined> {
    const recipe = this.recipes.get(recipeId);
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

    const updated: Recipe = {
      ...recipe,
      totalCost,
      costPerServing,
    };
    this.recipes.set(recipeId, updated);
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
    const recipeIngs = Array.from(this.recipeIngredients.values())
      .filter((ri) => ri.recipeId === recipeId);

    return recipeIngs.map((ri) => {
      const ingredientDetails = this.ingredients.get(ri.ingredientId);
      if (!ingredientDetails) {
        throw new Error(`Ingredient ${ri.ingredientId} not found`);
      }
      return {
        ...ri,
        ingredientDetails,
      };
    });
  }

  async createRecipeIngredient(insertRecipeIngredient: InsertRecipeIngredient): Promise<RecipeIngredient> {
    const id = randomUUID();
    const recipeIngredient: RecipeIngredient = {
      ...insertRecipeIngredient,
      id,
    };
    this.recipeIngredients.set(id, recipeIngredient);
    await this.recalculateRecipeCost(insertRecipeIngredient.recipeId);
    return recipeIngredient;
  }

  async updateRecipeIngredientQuantity(id: string, quantity: number): Promise<RecipeIngredient | undefined> {
    const existing = this.recipeIngredients.get(id);
    if (!existing) return undefined;

    const updated: RecipeIngredient = {
      ...existing,
      quantity,
    };
    this.recipeIngredients.set(id, updated);
    await this.recalculateRecipeCost(existing.recipeId);
    return updated;
  }

  async deleteRecipeIngredient(id: string): Promise<boolean> {
    const recipeIngredient = this.recipeIngredients.get(id);
    if (!recipeIngredient) return false;
    
    const deleted = this.recipeIngredients.delete(id);
    if (deleted) {
      await this.recalculateRecipeCost(recipeIngredient.recipeId);
    }
    return deleted;
  }
}

export const storage = new MemStorage();
