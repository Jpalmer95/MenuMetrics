import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const measurementUnits = [
  "cups",
  "ounces",
  "grams",
  "units",
  "teaspoons",
  "tablespoons",
  "pounds",
  "kilograms",
  "milliliters",
  "liters",
  "pints",
  "quarts",
  "gallons",
] as const;

export type MeasurementUnit = typeof measurementUnits[number];

export const ingredients = pgTable("ingredients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  
  // Purchase information (what you bought from the store)
  store: text("store"),
  purchaseQuantity: real("purchase_quantity").notNull(),
  purchaseUnit: text("purchase_unit").notNull(),
  purchaseCost: real("purchase_cost").notNull(),
  
  // Calculated per-unit costs (auto-calculated from purchase data)
  costPerOunce: real("cost_per_ounce"),
  costPerGram: real("cost_per_gram"),
  costPerCup: real("cost_per_cup"),
  costPerTbsp: real("cost_per_tbsp"),
  costPerTsp: real("cost_per_tsp"),
  costPerPound: real("cost_per_pound"),
  costPerKg: real("cost_per_kg"),
  costPerLiter: real("cost_per_liter"),
  costPerMl: real("cost_per_ml"),
  costPerPint: real("cost_per_pint"),
  costPerQuart: real("cost_per_quart"),
  costPerGallon: real("cost_per_gallon"),
  costPerUnit: real("cost_per_unit"), // For items sold as "each"
  
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const insertIngredientSchema = createInsertSchema(ingredients).omit({
  id: true,
  lastUpdated: true,
  // Omit all calculated cost fields - these are auto-calculated from purchase data
  costPerOunce: true,
  costPerGram: true,
  costPerCup: true,
  costPerTbsp: true,
  costPerTsp: true,
  costPerPound: true,
  costPerKg: true,
  costPerLiter: true,
  costPerMl: true,
  costPerPint: true,
  costPerQuart: true,
  costPerGallon: true,
  costPerUnit: true,
}).extend({
  purchaseQuantity: z.number().positive("Purchase quantity must be positive"),
  purchaseCost: z.number().nonnegative("Purchase cost must be non-negative"),
  store: z.string().optional(),
});

export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type Ingredient = typeof ingredients.$inferSelect;

export const recipeIngredients = pgTable("recipe_ingredients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipeId: varchar("recipe_id").notNull(),
  ingredientId: varchar("ingredient_id").notNull(),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
});

export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients).omit({
  id: true,
}).extend({
  quantity: z.number().positive("Quantity must be positive"),
});

export type InsertRecipeIngredient = z.infer<typeof insertRecipeIngredientSchema>;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;

export const recipeCategories = [
  "beverages",
  "pastries",
  "sandwiches",
  "salads",
  "breakfast",
  "lunch",
  "desserts",
  "snacks",
  "other",
] as const;

export type RecipeCategory = typeof recipeCategories[number];

export const recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("other"),
  servings: real("servings").notNull().default(1),
  totalCost: real("total_cost").notNull().default(0),
  costPerServing: real("cost_per_serving").notNull().default(0),
  menuPrice: real("menu_price"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
  totalCost: true,
  costPerServing: true,
  createdAt: true,
}).extend({
  servings: z.number().positive("Servings must be positive"),
  category: z.enum(recipeCategories),
  menuPrice: z.number().nonnegative("Menu price must be non-negative").optional(),
});

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

export interface RecipeWithIngredients extends Recipe {
  ingredients: Array<RecipeIngredient & { ingredientDetails: Ingredient }>;
}

export function calculateProfitMargin(menuPrice: number | null, costPerServing: number): number | null {
  if (!menuPrice || menuPrice <= 0 || costPerServing < 0) return null;
  return ((menuPrice - costPerServing) / menuPrice) * 100;
}

import { relations } from "drizzle-orm";

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  recipeIngredients: many(recipeIngredients),
}));

export const recipesRelations = relations(recipes, ({ many }) => ({
  recipeIngredients: many(recipeIngredients),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeIngredients.recipeId],
    references: [recipes.id],
  }),
  ingredient: one(ingredients, {
    fields: [recipeIngredients.ingredientId],
    references: [ingredients.id],
  }),
}));
