import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// REPLIT AUTH INTEGRATION: Session storage table
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// REPLIT AUTH INTEGRATION: User storage table
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  
  // Purchase information (what you bought from the store)
  store: text("store"),
  purchaseQuantity: real("purchase_quantity").notNull(),
  purchaseUnit: text("purchase_unit").notNull(),
  purchaseCost: real("purchase_cost").notNull(),
  
  // Price per unit - for items measured by unit (lemons, tomatoes, bags, napkins, etc.)
  // When set, this is the cost for each individual item
  pricePerUnit: real("price_per_unit"),
  
  // Density (for accurate volume↔weight conversions)
  // Stored as grams per milliliter (g/mL)
  // Example: Water = 1.0, Milk = 1.03, Flour = 0.5, Sugar = 0.85
  // Only used for weight/volume items, not for per-unit items
  gramsPerMilliliter: real("grams_per_milliliter"),
  densitySource: text("density_source"), // "preset", "manual", "imported", "USDA", etc.
  
  // Packaging flag (to separate packaging costs from ingredient costs)
  isPackaging: boolean("is_packaging").notNull().default(false),
  
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
  userId: true,
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
  pricePerUnit: z.number().positive("Price per unit must be positive").optional(),
  gramsPerMilliliter: z.number().positive("Density must be positive").optional(),
  densitySource: z.string().optional(),
  isPackaging: z.boolean().optional().default(false),
});

export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type Ingredient = typeof ingredients.$inferSelect;

export const recipeIngredients = pgTable("recipe_ingredients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: varchar("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
});

export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients).omit({
  id: true,
  userId: true,
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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  userId: true,
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

// AI Settings table - now per-user (instead of singleton)
export const aiSettings = pgTable("ai_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  aiProvider: varchar("ai_provider").default("openai"), // openai, gemini, grok, huggingface
  huggingfaceToken: text("huggingface_token"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAISettingsSchema = createInsertSchema(aiSettings).omit({
  id: true,
  userId: true,
  updatedAt: true,
});

export type InsertAISettings = z.infer<typeof insertAISettingsSchema>;
export type AISettingsData = typeof aiSettings.$inferSelect;

// Density heuristics table - global reference densities for common ingredients
export const densityHeuristics = pgTable("density_heuristics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ingredientName: text("ingredient_name").notNull().unique(),
  gramsPerMilliliter: real("grams_per_milliliter").notNull(),
  category: text("category"), // e.g., "Dairy", "Flour", "Sugar", "Oil", etc.
  notes: text("notes"), // Optional notes about the ingredient
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const insertDensityHeuristicSchema = createInsertSchema(densityHeuristics).omit({
  id: true,
  lastUpdated: true,
});

export type InsertDensityHeuristic = z.infer<typeof insertDensityHeuristicSchema>;
export type DensityHeuristic = typeof densityHeuristics.$inferSelect;

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
