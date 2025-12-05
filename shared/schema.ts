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
  // Stripe subscription fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionTier: varchar("subscription_tier").default("free"), // free, trial, starter, professional, business
  subscriptionStatus: varchar("subscription_status").default("inactive"), // inactive, trialing, active, past_due, canceled
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"),
  trialEndsAt: timestamp("trial_ends_at"),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Subscription tiers configuration
export const subscriptionTiers = {
  free: { name: "Free", aiQueriesPerMonth: 0, priceMonthly: 0 },
  trial: { name: "Free Trial", aiQueriesPerMonth: 10, priceMonthly: 0, durationDays: 7 },
  starter: { name: "Starter", aiQueriesPerMonth: 50, priceMonthly: 1900 }, // $19.00
  professional: { name: "Professional", aiQueriesPerMonth: 200, priceMonthly: 4900 }, // $49.00
  business: { name: "Business", aiQueriesPerMonth: 500, priceMonthly: 9900 }, // $99.00
} as const;

export type SubscriptionTier = keyof typeof subscriptionTiers;

// AI Usage tracking table
export const aiUsage = pgTable("ai_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  queriesUsed: real("queries_used").notNull().default(0),
  lastQueryAt: timestamp("last_query_at"),
});

export const insertAiUsageSchema = createInsertSchema(aiUsage).omit({
  id: true,
});

export type InsertAiUsage = z.infer<typeof insertAiUsageSchema>;
export type AiUsage = typeof aiUsage.$inferSelect;

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
  
  // Yield percentage - accounts for inedible portions (peels, cores, brine, etc.)
  // Default 97% (3% waste) - for items like bananas use ~65% (35% peel waste)
  // This affects the effective cost: Effective Cost = Purchase Cost ÷ (yieldPercentage / 100)
  // Different from Global Waste % which accounts for operational losses (theft, expiration, etc.)
  yieldPercentage: real("yield_percentage").notNull().default(97),
  
  // Inventory management fields
  parValue: real("par_value"), // Target stock level (reorder point)
  currentStock: real("current_stock"), // Current quantity on hand
  storageType: text("storage_type"), // "dry", "cold", "frozen", "supplies"
  countFrequency: text("count_frequency"), // "weekly", "monthly", "as_needed"
  lastCountDate: timestamp("last_count_date"), // When inventory was last counted
  
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
  yieldPercentage: z.number().min(1, "Yield must be at least 1%").max(100, "Yield cannot exceed 100%").optional().default(97),
  parValue: z.number().nonnegative("Par value must be non-negative").optional(),
  currentStock: z.number().nonnegative("Current stock must be non-negative").optional(),
  storageType: z.enum(["dry", "cold", "frozen", "supplies"]).optional(),
  countFrequency: z.enum(["weekly", "monthly", "as_needed"]).optional(),
});

export const storageTypes = ["dry", "cold", "frozen", "supplies"] as const;
export type StorageType = typeof storageTypes[number];

export const countFrequencies = ["weekly", "monthly", "as_needed"] as const;
export type CountFrequency = typeof countFrequencies[number];

export const storageTypeLabels: Record<StorageType, string> = {
  dry: "Dry Storage",
  cold: "Refrigerated",
  frozen: "Frozen",
  supplies: "Supplies",
};

export const countFrequencyLabels: Record<CountFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  as_needed: "As Needed",
};

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

export const recipeSubIngredients = pgTable("recipe_sub_ingredients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  subRecipeId: varchar("sub_recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  quantity: real("quantity").notNull(),
});

export const insertRecipeSubIngredientSchema = createInsertSchema(recipeSubIngredients).omit({
  id: true,
  userId: true,
}).extend({
  quantity: z.number().positive("Quantity must be positive"),
});

export type InsertRecipeSubIngredient = z.infer<typeof insertRecipeSubIngredientSchema>;
export type RecipeSubIngredient = typeof recipeSubIngredients.$inferSelect;

export const recipeCategories = [
  "food",
  "drink",
  "seasonal_food",
  "seasonal_drink",
  "other",
] as const;

export type RecipeCategory = typeof recipeCategories[number];

export const recipeCategoryLabels: Record<RecipeCategory, string> = {
  food: "Food",
  drink: "Drink",
  seasonal_food: "Seasonal Food",
  seasonal_drink: "Seasonal Drink",
  other: "Other",
};

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
  wastePercentage: real("waste_percentage").notNull().default(0),
  targetMargin: real("target_margin").notNull().default(70),
  consumablesBuffer: real("consumables_buffer").notNull().default(0),
  isPackagingPreset: boolean("is_packaging_preset").notNull().default(false),
  isBaseRecipe: boolean("is_base_recipe").notNull().default(false),
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
  wastePercentage: z.number().min(0).max(99).optional(),
  targetMargin: z.number().min(1).max(99).optional(),
  consumablesBuffer: z.number().nonnegative().optional(),
  isPackagingPreset: z.boolean().optional().default(false),
  isBaseRecipe: z.boolean().optional().default(false),
});

export const updateRecipePricingSchema = z.object({
  wastePercentage: z.number().min(0).max(99).optional(),
  targetMargin: z.number().min(1).max(99).optional(),
  consumablesBuffer: z.number().nonnegative().optional(),
  menuPrice: z.number().nonnegative().optional(),
});

export type UpdateRecipePricing = z.infer<typeof updateRecipePricingSchema>;

export function calculateSuggestedPrice(
  baseCost: number,
  wastePct: number,
  marginPct: number,
  bufferFlat: number
): number {
  const clampedWaste = Math.min(Math.max(wastePct, 0), 99);
  const clampedMargin = Math.min(Math.max(marginPct, 1), 99);
  const yieldPct = 1 - clampedWaste / 100;
  const trueCost = baseCost / yieldPct;
  const totalCost = trueCost + bufferFlat;
  const costPct = 1 - clampedMargin / 100;
  const rawPrice = totalCost / costPct;
  return Math.round(rawPrice * 100) / 100;
}

export function calculateTrueCost(
  baseCost: number,
  wastePct: number,
  bufferFlat: number
): number {
  const clampedWaste = Math.min(Math.max(wastePct, 0), 99);
  const yieldPct = 1 - clampedWaste / 100;
  const trueCost = baseCost / yieldPct;
  return Math.round((trueCost + bufferFlat) * 100) / 100;
}

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

export interface RecipeWithIngredients extends Recipe {
  ingredients: Array<RecipeIngredient & { ingredientDetails: Ingredient }>;
  subRecipes?: Array<RecipeSubIngredient & { subRecipeDetails: Recipe }>;
}

export function calculateProfitMargin(menuPrice: number | null, costPerServing: number): number | null {
  if (!menuPrice || menuPrice <= 0 || costPerServing < 0) return null;
  return ((menuPrice - costPerServing) / menuPrice) * 100;
}

// Category pricing settings - stores default waste and margin per category
export const categoryPricingSettings = pgTable("category_pricing_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // food, drink, seasonal_food, seasonal_drink, other
  wastePercentage: real("waste_percentage").notNull().default(15),
  targetMargin: real("target_margin").notNull().default(80),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCategoryPricingSettingsSchema = createInsertSchema(categoryPricingSettings).omit({
  id: true,
  userId: true,
  updatedAt: true,
}).extend({
  category: z.enum(recipeCategories),
  wastePercentage: z.number().min(0).max(99),
  targetMargin: z.number().min(1).max(99),
});

export type InsertCategoryPricingSettings = z.infer<typeof insertCategoryPricingSettingsSchema>;
export type CategoryPricingSettings = typeof categoryPricingSettings.$inferSelect;

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

// Waste reasons for tracking different types of loss
export const wasteReasons = [
  "expired",
  "spoiled", 
  "broken",
  "mis_ordered",
  "over_prepared",
  "customer_return",
  "quality_issue",
  "training_loss",
  "other",
] as const;

export type WasteReason = typeof wasteReasons[number];

export const wasteReasonLabels: Record<WasteReason, string> = {
  expired: "Expired",
  spoiled: "Spoiled/Went Bad",
  broken: "Broken/Damaged",
  mis_ordered: "Mis-ordered",
  over_prepared: "Over-prepared",
  customer_return: "Customer Return",
  quality_issue: "Quality Issue",
  training_loss: "Training Loss",
  other: "Other",
};

// Waste log table - tracks all waste events
export const wasteLogs = pgTable("waste_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ingredientId: varchar("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  reason: text("reason").notNull(), // one of wasteReasons
  notes: text("notes"),
  costAtTime: real("cost_at_time").notNull(), // Calculated cost at time of waste
  wastedAt: timestamp("wasted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWasteLogSchema = createInsertSchema(wasteLogs).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  quantity: z.number().positive("Quantity must be positive"),
  reason: z.enum(wasteReasons),
  notes: z.string().optional(),
  costAtTime: z.number().nonnegative("Cost must be non-negative"),
  wastedAt: z.date().optional(),
});

export type InsertWasteLog = z.infer<typeof insertWasteLogSchema>;
export type WasteLog = typeof wasteLogs.$inferSelect;

export interface WasteLogWithIngredient extends WasteLog {
  ingredient: Ingredient;
}

// Inventory count history - tracks when counts were done
export const inventoryCounts = pgTable("inventory_counts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  storageType: text("storage_type"), // null for all items
  countedAt: timestamp("counted_at").defaultNow().notNull(),
  itemsCounted: real("items_counted").notNull().default(0),
  notes: text("notes"),
});

export const insertInventoryCountSchema = createInsertSchema(inventoryCounts).omit({
  id: true,
  userId: true,
}).extend({
  storageType: z.enum(storageTypes).optional(),
  countedAt: z.date().optional(),
  itemsCounted: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export type InsertInventoryCount = z.infer<typeof insertInventoryCountSchema>;
export type InventoryCount = typeof inventoryCounts.$inferSelect;

import { relations } from "drizzle-orm";

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  recipeIngredients: many(recipeIngredients),
  wasteLogs: many(wasteLogs),
}));

export const wasteLogsRelations = relations(wasteLogs, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [wasteLogs.ingredientId],
    references: [ingredients.id],
  }),
}));

export const recipesRelations = relations(recipes, ({ many }) => ({
  recipeIngredients: many(recipeIngredients),
  recipeSubIngredients: many(recipeSubIngredients),
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

export const recipeSubIngredientsRelations = relations(recipeSubIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeSubIngredients.recipeId],
    references: [recipes.id],
  }),
  subRecipe: one(recipes, {
    fields: [recipeSubIngredients.subRecipeId],
    references: [recipes.id],
  }),
}));

// Dashboard chart types available
export const dashboardChartTypes = [
  "most_expensive_recipes",
  "cost_efficient_recipes",
  "ingredients_by_category",
  "margin_analysis",
  "food_cost_percentage",
  "menu_engineering_matrix",
  "top_revenue_drivers",
  "waste_impact",
  "inventory_value",
  "ingredient_price_trends",
  "profit_margin_distribution",
  "category_performance",
] as const;

export type DashboardChartType = typeof dashboardChartTypes[number];

export const dashboardChartLabels: Record<DashboardChartType, { name: string; description: string }> = {
  most_expensive_recipes: { name: "Most Expensive Recipes", description: "Recipes with highest cost per serving" },
  cost_efficient_recipes: { name: "Cost-Efficient Recipes", description: "Recipes with lowest cost per serving" },
  ingredients_by_category: { name: "Ingredients by Category", description: "Distribution of inventory by category" },
  margin_analysis: { name: "Margin Analysis", description: "Most profitable items by dollar per unit" },
  food_cost_percentage: { name: "Food Cost %", description: "Recipes by food cost percentage (target: 28-35%)" },
  menu_engineering_matrix: { name: "Menu Engineering Matrix", description: "Stars, Puzzles, Plowhorses, Dogs classification" },
  top_revenue_drivers: { name: "Top Revenue Drivers", description: "Items generating most total profit" },
  waste_impact: { name: "Waste Impact", description: "Money lost to waste by category" },
  inventory_value: { name: "Inventory Value", description: "Current stock value by category" },
  ingredient_price_trends: { name: "Ingredient Trends", description: "Track ingredient cost changes over time" },
  profit_margin_distribution: { name: "Profit Margin Distribution", description: "Distribution of profit margins across menu" },
  category_performance: { name: "Category Performance", description: "Compare performance across recipe categories" },
};

// Dashboard configuration table - stores user's dashboard layout
export const dashboardConfigs = pgTable("dashboard_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chartType: text("chart_type").notNull(), // one of dashboardChartTypes
  position: real("position").notNull().default(0), // Order position on dashboard
  width: text("width").notNull().default("half"), // "half" or "full"
  isVisible: boolean("is_visible").notNull().default(true),
  customConfig: jsonb("custom_config"), // For AI-generated charts, stores chart configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDashboardConfigSchema = createInsertSchema(dashboardConfigs).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  chartType: z.string(),
  position: z.number().nonnegative().optional(),
  width: z.enum(["half", "full"]).optional(),
  isVisible: z.boolean().optional(),
  customConfig: z.any().optional(),
});

export type InsertDashboardConfig = z.infer<typeof insertDashboardConfigSchema>;
export type DashboardConfig = typeof dashboardConfigs.$inferSelect;
