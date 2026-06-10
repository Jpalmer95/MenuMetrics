/**
 * Agent Bridge — token-protected API for external agents/platforms
 * (Kynda Coffee platform sync, Hermes crons, AI recipe recommendations).
 *
 * Why: the app's normal routes are session-authenticated (OIDC login) which a
 * server-to-server client can't use. This bridge exposes cost/inventory reads
 * plus a small, safe write surface (create recipes/ingredients for cost
 * analysis), guarded by a shared secret, and returns the exact shape the
 * Kynda platform client consumes (cents-denominated, snake_case).
 *
 * Auth: `Authorization: Bearer <token>` or `X-Agent-Token: <token>` where
 * token = AGENT_BRIDGE_TOKEN env, or the contents of .agent-bridge-token in
 * the app root (file fallback avoids container re-creation).
 *
 * Tenant: data is per-user; the bridge serves AGENT_BRIDGE_USER_EMAIL's data,
 * else the first user (single-tenant deployments).
 *
 * Write surface (v2, 2026-06): agents may CREATE recipes + ingredients and
 * attach recipe lines so an AI can propose a new menu item and immediately
 * get fully-loaded cost + price recommendation. Writes are tagged
 * (description prefix "[agent]") and never touch existing rows — update and
 * delete remain owner-only via the normal UI.
 */
import type { Express, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { db } from "./db";
import {
  users,
  insertRecipeSchema,
  insertIngredientSchema,
  insertRecipeIngredientSchema,
} from "@shared/schema";
import { normalizeUnit } from "@shared/unit-parser";

/** Canonicalize agent-supplied units ("g" → "grams"); fall back to "units". */
function canonicalUnit(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s === "each" || s === "unit" || s === "units") return "units";
  return normalizeUnit(s) ?? "units";
}

let cachedToken: string | null | undefined;

function bridgeToken(): string | null {
  if (cachedToken !== undefined) return cachedToken;
  const fromEnv = process.env.AGENT_BRIDGE_TOKEN?.trim();
  if (fromEnv) {
    cachedToken = fromEnv;
    return cachedToken;
  }
  try {
    const p = path.resolve(process.cwd(), ".agent-bridge-token");
    const fromFile = fs.readFileSync(p, "utf8").trim();
    cachedToken = fromFile || null;
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

function requireAgentToken(req: Request, res: Response, next: NextFunction) {
  const token = bridgeToken();
  if (!token) {
    return res.status(503).json({ message: "Agent bridge not configured." });
  }
  const auth = req.headers.authorization ?? "";
  const presented =
    (auth.startsWith("Bearer ") ? auth.slice(7) : "") ||
    (req.headers["x-agent-token"] as string | undefined) ||
    "";
  if (presented.trim() !== token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

async function bridgeUserId(): Promise<string | null> {
  const all = await db.select().from(users);
  if (all.length === 0) return null;
  const wanted = process.env.AGENT_BRIDGE_USER_EMAIL?.trim().toLowerCase();
  if (wanted) {
    const match = all.find((u: any) => (u.email ?? "").toLowerCase() === wanted);
    if (match) return match.id;
  }
  return all[0].id;
}

const toCents = (dollars: number | null | undefined) =>
  Math.round(((dollars ?? 0) as number) * 100);

function recipeOut(r: any) {
  return {
    id: r.id,
    name: r.name,
    category: r.category ?? "other",
    yield_servings: r.servings ?? 1,
    cost_per_serving_cents: toCents(r.costPerServing),
    ingredient_cost_cents: toCents(r.totalCost),
    menu_price_cents: r.menuPrice != null ? toCents(r.menuPrice) : null,
    target_margin_pct: r.targetMargin ?? 70,
    waste_percentage: r.wastePercentage ?? 0,
    updated_at: (r.createdAt ?? new Date()).toISOString?.() ?? String(r.createdAt),
  };
}

/** Suggested menu price from cost + target margin (food-cost-% model). */
function priceRecommendation(costPerServingCents: number, targetMarginPct: number) {
  const margin = Math.min(Math.max(targetMarginPct, 1), 95) / 100;
  const raw = costPerServingCents / (1 - margin);
  // Round UP to a .25 boundary — café-friendly price points.
  const rounded = Math.ceil(raw / 25) * 25;
  return {
    suggested_price_cents: rounded,
    food_cost_pct_at_suggested: rounded > 0 ? Math.round((costPerServingCents / rounded) * 1000) / 10 : 0,
  };
}

export function registerAgentBridge(app: Express) {
  // Liveness (no data) — lets callers verify token + reachability.
  app.get("/api/agent/health", requireAgentToken, async (_req, res) => {
    const userId = await bridgeUserId();
    res.json({ ok: true, tenant_resolved: Boolean(userId), write_enabled: true });
  });

  // Recipes with computed costs (Kynda shape: MenuMetricsRecipeCost)
  app.get("/api/agent/recipes", requireAgentToken, async (_req, res) => {
    try {
      const userId = await bridgeUserId();
      if (!userId) return res.json([]);
      const recipes = await storage.getAllRecipes(userId);
      res.json(recipes.map(recipeOut));
    } catch (err) {
      console.error("[agent-bridge] recipes failed:", err);
      res.status(500).json({ message: "Failed to load recipes" });
    }
  });

  // Single recipe with cost + price recommendation
  app.get("/api/agent/recipes/:id", requireAgentToken, async (req, res) => {
    try {
      const userId = await bridgeUserId();
      if (!userId) return res.status(404).json({ message: "Not found" });
      const recipe = await storage.getRecipeWithIngredients(req.params.id, userId);
      if (!recipe) return res.status(404).json({ message: "Not found" });
      const out = recipeOut(recipe);
      res.json({
        ...out,
        pricing: priceRecommendation(out.cost_per_serving_cents, out.target_margin_pct),
        ingredients: ((recipe as any).ingredients ?? []).map((ri: any) => ({
          ingredient_id: ri.ingredientId,
          name: ri.ingredientDetails?.name,
          quantity: ri.quantity,
          unit: ri.unit,
        })),
      });
    } catch (err) {
      console.error("[agent-bridge] recipe failed:", err);
      res.status(500).json({ message: "Failed to load recipe" });
    }
  });

  // Ingredients with vendor cost (Kynda shape: MenuMetricsIngredient)
  app.get("/api/agent/ingredients", requireAgentToken, async (_req, res) => {
    try {
      const userId = await bridgeUserId();
      if (!userId) return res.json([]);
      const ingredients = await storage.getAllIngredients(userId);
      res.json(
        ingredients.map((i: any) => ({
          id: i.id,
          name: i.name,
          vendor: i.store ?? null,
          pack_size:
            i.purchaseQuantity != null && i.purchaseUnit
              ? `${i.purchaseQuantity} ${i.purchaseUnit}`
              : null,
          cost_cents: toCents(i.purchaseCost),
          unit: i.purchaseUnit ?? "each",
          density_g_per_ml: i.gramsPerMilliliter ?? null,
          updated_at: (i.lastUpdated ?? new Date()).toISOString?.() ?? String(i.lastUpdated),
        }))
      );
    } catch (err) {
      console.error("[agent-bridge] ingredients failed:", err);
      res.status(500).json({ message: "Failed to load ingredients" });
    }
  });

  // Stock levels (Kynda shape: MenuMetricsStock)
  app.get("/api/agent/stock", requireAgentToken, async (_req, res) => {
    try {
      const userId = await bridgeUserId();
      if (!userId) return res.json([]);
      const ingredients = await storage.getAllIngredients(userId);
      res.json(
        ingredients
          .filter((i: any) => i.currentStock != null || i.parValue != null)
          .map((i: any) => ({
            ingredient_id: i.id,
            name: i.name,
            on_hand: i.currentStock ?? 0,
            unit: i.purchaseUnit ?? "each",
            reorder_threshold: i.parValue ?? null,
            updated_at:
              (i.lastCountDate ?? i.lastUpdated ?? new Date()).toISOString?.() ??
              String(i.lastUpdated),
          }))
      );
    } catch (err) {
      console.error("[agent-bridge] stock failed:", err);
      res.status(500).json({ message: "Failed to load stock" });
    }
  });

  // ── Write surface (create-only, agent-tagged) ──────────────────────────

  // Create an ingredient. Body: { name, category, store?, purchase_quantity,
  // purchase_unit, purchase_cost_cents, grams_per_milliliter? }
  app.post("/api/agent/ingredients", requireAgentToken, async (req, res) => {
    try {
      const userId = await bridgeUserId();
      if (!userId) return res.status(503).json({ message: "No tenant user" });
      const b = req.body ?? {};
      const parsed = insertIngredientSchema.parse({
        name: String(b.name ?? "").trim(),
        category: String(b.category ?? "other").trim(),
        store: b.store != null ? String(b.store) : null,
        purchaseQuantity: Number(b.purchase_quantity),
        purchaseUnit: canonicalUnit(b.purchase_unit),
        purchaseCost: Number(b.purchase_cost_cents ?? 0) / 100,
        ...(b.grams_per_milliliter != null
          ? { gramsPerMilliliter: Number(b.grams_per_milliliter), densitySource: "agent" }
          : {}),
      });
      const ingredient = await storage.createIngredient(parsed, userId);
      res.status(201).json({ id: ingredient.id, name: ingredient.name });
    } catch (err) {
      console.error("[agent-bridge] create ingredient failed:", err);
      res.status(400).json({ message: "Invalid ingredient data" });
    }
  });

  // Create a recipe (agent-proposed menu item). Body: { name, description?,
  // category?, servings?, target_margin_pct?, ingredients?: [{ingredient_id,
  // quantity, unit}] }. Returns full cost + price recommendation.
  app.post("/api/agent/recipes", requireAgentToken, async (req, res) => {
    try {
      const userId = await bridgeUserId();
      if (!userId) return res.status(503).json({ message: "No tenant user" });
      const b = req.body ?? {};
      // Tolerant category mapping — agents say "beverage"/"coffee"; the schema
      // enum is food|drink|seasonal_food|seasonal_drink|other.
      const rawCat = String(b.category ?? "other").toLowerCase().trim();
      const category =
        ["food", "drink", "seasonal_food", "seasonal_drink", "other"].includes(rawCat)
          ? rawCat
          : ["beverage", "coffee", "espresso", "tea", "smoothie", "latte"].some((k) => rawCat.includes(k))
            ? "drink"
            : ["pastry", "sandwich", "breakfast", "lunch", "bakery", "snack"].some((k) => rawCat.includes(k))
              ? "food"
              : "other";
      const parsed = insertRecipeSchema.parse({
        name: String(b.name ?? "").trim(),
        description: `[agent] ${String(b.description ?? "proposed by AI agent").trim()}`.slice(0, 1000),
        category,
        servings: Number(b.servings ?? 1),
        ...(b.target_margin_pct != null ? { targetMargin: Number(b.target_margin_pct) } : {}),
      });
      const recipe = await storage.createRecipe(parsed, userId);

      const lines = Array.isArray(b.ingredients) ? b.ingredients : [];
      const lineErrors: string[] = [];
      for (const line of lines) {
        try {
          const lineParsed = insertRecipeIngredientSchema.parse({
            recipeId: recipe.id,
            ingredientId: String(line.ingredient_id ?? ""),
            quantity: Number(line.quantity),
            unit: canonicalUnit(line.unit),
          });
          await storage.createRecipeIngredient(lineParsed, userId);
        } catch (lineErr) {
          lineErrors.push(`${line.ingredient_id}: ${String(lineErr).slice(0, 120)}`);
        }
      }

      // Recalculate + reload so the response carries real costs.
      const recalced =
        (await (storage as any).recalculateRecipeCost?.(recipe.id, userId)) ??
        (await storage.getRecipe(recipe.id, userId)) ??
        recipe;
      const out = recipeOut(recalced);
      res.status(201).json({
        ...out,
        pricing: priceRecommendation(out.cost_per_serving_cents, out.target_margin_pct),
        ...(lineErrors.length > 0 ? { line_errors: lineErrors } : {}),
      });
    } catch (err) {
      console.error("[agent-bridge] create recipe failed:", err);
      res.status(400).json({ message: "Invalid recipe data" });
    }
  });
}
