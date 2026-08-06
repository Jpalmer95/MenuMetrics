/**
 * Agent Bridge v3 — token-protected API for external agents and platforms
 * (Hermes Agent companion skills, Kynda Coffee sync, Claude/Codex bots, etc).
 *
 * Auth (two modes):
 *   1. Per-user keys — "mm_" prefixed tokens created from Settings → Agent API
 *      (or POST /api/agent-keys). Only the sha256 hash is stored; the secret
 *      is shown once at creation. Tenancy resolves from the key itself, so a
 *      hosted multi-user deployment works out of the box.
 *   2. Global token (legacy/self-host) — AGENT_BRIDGE_TOKEN env var or
 *      .agent-bridge-token file; serves AGENT_BRIDGE_USER_EMAIL's data (or the
 *      first user). Kept for single-tenant self-hosters.
 *
 * Accepts `Authorization: Bearer <token>` or `X-Agent-Token: <token>`.
 *
 * Surface:
 *   Read  — health, me, summary, recipes, recipes/:id, ingredients, stock,
 *           waste, density-heuristics, density-heuristics/suggest, openapi.json
 *   Write — ingredients (single/bulk/import-excel/densities/patch),
 *           recipes (create/import/pricing), tagged "[agent]" where created.
 *
 * Money is cents-denominated (snake_case) to match the Kynda platform client;
 * the UI continues to use dollars.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { createHash, randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import ExcelJS from "exceljs";
import { storage } from "./storage";
import { db } from "./db";
import {
  users,
  insertRecipeSchema,
  insertIngredientSchema,
  insertRecipeIngredientSchema,
  type MeasurementUnit,
} from "@shared/schema";
import { normalizeUnit, parseQuantityUnit } from "@shared/unit-parser";
import { findBestMatch } from "@shared/fuzzy-matcher";
import { CURATED_DENSITIES } from "@shared/density-reference";
import { callAI, type AIProvider } from "./ai-providers";

const bridgeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** Canonicalize agent-supplied units ("g" → "grams"); fall back to "units". */
function canonicalUnit(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s === "each" || s === "unit" || s === "units") return "units";
  return normalizeUnit(s) ?? "units";
}

// ── Auth ────────────────────────────────────────────────────────────────────

let cachedToken: string | null | undefined;

function globalBridgeToken(): string | null {
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

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Generate a new per-user agent token: mm_<16 hex>_<32 hex secret>. */
export function generateAgentToken(): { prefix: string; secret: string; token: string; tokenHash: string } {
  const prefix = `mm_${randomBytes(8).toString("hex")}`;
  const secret = randomBytes(16).toString("hex");
  return { prefix, secret, token: `${prefix}_${secret}`, tokenHash: sha256(secret) };
}

interface BridgeIdentity {
  userId: string | null;
  mode: "per_user" | "global" | "none";
}

async function resolveIdentity(presented: string | null): Promise<BridgeIdentity> {
  if (presented) {
    // Per-user key: mm_<prefix>_<secret> — match on hash of the secret part.
    if (presented.startsWith("mm_")) {
      const parts = presented.split("_");
      const secret = parts.slice(2).join("_");
      if (secret) {
        const key = await storage.getAgentApiKeyByHash(sha256(secret));
        if (key && !key.revokedAt) {
          await storage.touchAgentApiKey(key.id).catch(() => {});
          return { userId: key.userId, mode: "per_user" };
        }
        return { userId: null, mode: "none" };
      }
      return { userId: null, mode: "none" };
    }
    // Global token fallback (self-host single-tenant).
    const globalToken = globalBridgeToken();
    if (globalToken && presented.trim() === globalToken) {
      const all = await db.select().from(users);
      if (all.length === 0) return { userId: null, mode: "global" };
      const wanted = process.env.AGENT_BRIDGE_USER_EMAIL?.trim().toLowerCase();
      if (wanted) {
        const match = all.find((u: any) => (u.email ?? "").toLowerCase() === wanted);
        if (match) return { userId: match.id, mode: "global" };
      }
      return { userId: all[0].id, mode: "global" };
    }
  }
  return { userId: null, mode: "none" };
}

function requireAgent(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization ?? "";
  const presented =
    (auth.startsWith("Bearer ") ? auth.slice(7) : "") ||
    (req.headers["x-agent-token"] as string | undefined) ||
    "";
  resolveIdentity(presented.trim() || null)
    .then((identity) => {
      if (!identity.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      (req as any).agentIdentity = identity;
      next();
    })
    .catch((err) => {
      console.error("[agent-bridge] auth error:", err);
      res.status(500).json({ message: "Auth lookup failed" });
    });
}

// ── Serializers (cents-denominated, snake_case) ─────────────────────────────

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

function ingredientOut(i: any) {
  return {
    id: i.id,
    name: i.name,
    vendor: i.store ?? null,
    pack_size: i.purchaseQuantity != null && i.purchaseUnit ? `${i.purchaseQuantity} ${i.purchaseUnit}` : null,
    cost_cents: toCents(i.purchaseCost),
    unit: i.purchaseUnit ?? "each",
    density_g_per_ml: i.gramsPerMilliliter ?? null,
    density_source: i.densitySource ?? null,
    yield_percentage: i.yieldPercentage ?? 97,
    updated_at: (i.lastUpdated ?? new Date()).toISOString?.() ?? String(i.lastUpdated),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function marginOf(recipe: any): number | null {
  const price = recipe.menuPrice;
  const cost = recipe.costPerServing ?? recipe.totalCost ?? 0;
  if (!price || price <= 0) return null;
  return ((price - cost) / price) * 100;
}

async function loadDensityHeuristics() {
  const fromDb = await storage.getAllDensityHeuristics();
  if (fromDb.length > 0) return fromDb;
  // Fallback: curated static reference (also used by the seed script).
  return CURATED_DENSITIES.map((d) => ({
    id: d.ingredientName,
    ingredientName: d.ingredientName,
    gramsPerMilliliter: d.gramsPerMilliliter,
    category: d.category ?? null,
    notes: d.notes ?? null,
    lastUpdated: new Date(0),
  }));
}

/** Fuzzy-match an ingredient name against the density reference table. */
function suggestDensity(name: string, refs: Array<{ ingredientName: string; gramsPerMilliliter: number }>) {
  const withName = refs.filter((r) => r.ingredientName?.trim()).map((r) => ({ ...r, name: r.ingredientName }));
  const result = findBestMatch(name, withName, {
    autoMatchThreshold: 0.78,
    minThreshold: 0.62,
    useNormalization: true,
  });
  if (!result) return null;
  return {
    matched_name: result.match.ingredientName,
    grams_per_milliliter: result.match.gramsPerMilliliter,
    confidence: Math.round(result.confidence * 100) / 100,
    exact: Boolean((result as any).exactMatch),
  };
}

/** Parse an ingredients Excel workbook into canonical rows (header auto-detect). */
async function parseIngredientWorkbook(buffer: Buffer): Promise<Array<Record<string, unknown>>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  const rows: Array<Record<string, unknown>> = [];
  let headers: string[] = [];
  let headerCount = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const value = String(cell.value ?? "").trim();
        if (value) {
          headers[colNumber - 1] = value;
          headerCount = Math.max(headerCount, colNumber);
        }
      });
      // Normalize headers for alias matching.
      headers = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
    } else {
      const rowData: Record<string, unknown> = {};
      let hasData = false;
      for (let i = 1; i <= headerCount; i++) {
        const header = headers[i - 1];
        if (header) {
          const value = (row.getCell(i) as any).value;
          if (value !== null && value !== undefined && value !== "") {
            rowData[header] = value;
            hasData = true;
          }
        }
      }
      if (hasData) rows.push(rowData);
    }
  });
  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["name", "ingredient", "item", "item_name", "ingredient_name", "product", "product_name", "description"],
  category: ["category", "type", "group", "department", "ingredient_category"],
  store: ["store", "vendor", "supplier", "source", "where_bought"],
  purchase_quantity: ["purchase_quantity", "quantity", "qty", "amount", "size", "pack_size", "package_size"],
  purchase_unit: ["purchase_unit", "unit", "units", "pack_unit", "size_unit", "measure"],
  purchase_cost: ["purchase_cost", "cost", "price", "total_cost", "total_price", "price_paid", "amount_paid", "$"],
  price_per_unit: ["price_per_unit", "unit_cost", "unit_price", "each_cost", "cost_each", "per_unit"],
  grams_per_milliliter: ["grams_per_milliliter", "density", "g_ml", "g_per_ml", "density_g_ml", "specific_gravity"],
  yield_percentage: ["yield", "yield_percentage", "yield_pct", "edible_yield"],
};

function mapRow(row: Record<string, unknown>): { name?: string; category?: string; store?: string; purchaseQuantity?: number; purchaseUnit?: string; purchaseCost?: number; pricePerUnit?: number; gramsPerMilliliter?: number; yieldPercentage?: number } {
  const pick = (field: string): unknown => {
    const aliases = HEADER_ALIASES[field] || [field];
    for (const key of Object.keys(row)) {
      if (aliases.includes(key)) return row[key];
    }
    return undefined;
  };
  const num = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = parseFloat(String(v).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (v: unknown): string | undefined => {
    if (v === null || v === undefined || v === "") return undefined;
    return String(v).trim();
  };
  return {
    name: str(pick("name")),
    category: str(pick("category")) || "other",
    store: str(pick("store")),
    purchaseQuantity: num(pick("purchase_quantity")),
    purchaseUnit: str(pick("purchase_unit")),
    purchaseCost: num(pick("purchase_cost")),
    pricePerUnit: num(pick("price_per_unit")),
    gramsPerMilliliter: num(pick("grams_per_milliliter")),
    yieldPercentage: num(pick("yield_percentage")),
  };
}

// ── Routes ──────────────────────────────────────────────────────────────────

export function registerAgentBridge(app: Express) {
  // ── Meta ────────────────────────────────────────────────────────────────

  // Liveness + auth mode — no token needed, tells callers how to authenticate.
  app.get("/api/agent/health", async (_req, res) => {
    const globalConfigured = Boolean(globalBridgeToken());
    res.json({
      ok: true,
      name: "MenuMetrics Agent Bridge",
      version: 3,
      auth_modes: {
        per_user_keys: true,
        global_token: globalConfigured,
      },
      write_enabled: true,
      docs: "/api/agent/openapi.json",
    });
  });

  // OpenAPI 3.0.3 specification of the whole bridge — lets any agent framework
  // (Hermes, Claude Code, OpenAPI generators, MCP bridges) consume it.
  app.get("/api/agent/openapi.json", (_req, res) => {
    res.json(buildOpenApiSpec());
  });

  // Who am I + how complete is my data (the onboarding checklist for agents).
  app.get("/api/agent/me", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const [ingredients, recipes, usage] = await Promise.all([
        storage.getAllIngredients(userId),
        storage.getAllRecipes(userId),
        storage.getAiUsageRemaining(userId),
      ]);
      const usedInRecipes = new Set<string>();
      const fullRecipes = await storage.getAllRecipesWithIngredients(userId);
      for (const r of fullRecipes) for (const ri of r.ingredients ?? []) usedInRecipes.add(ri.ingredientId);
      const missingDensity = ingredients.filter((i: any) => !i.isPackaging && !i.gramsPerMilliliter && usedInRecipes.has(i.id));
      const unpriced = recipes.filter((r: any) => !r.menuPrice || r.menuPrice <= 0);
      res.json({
        user: {
          email: user.email,
          tier: user.subscriptionTier ?? "free",
          subscription_status: user.subscriptionStatus ?? "inactive",
        },
        auth: { mode: req.agentIdentity.mode },
        data: {
          ingredients_count: ingredients.length,
          recipes_count: recipes.length,
          unpriced_recipes: unpriced.map((r: any) => ({ id: r.id, name: r.name, cost_per_serving_cents: toCents(r.costPerServing) })),
          recipes_missing_density: missingDensity.map((i: any) => ({ id: i.id, name: i.name })),
          ai_usage: usage,
        },
        onboarding: {
          needs_densities: missingDensity.length > 0,
          needs_pricing: unpriced.length > 0,
          needs_ingredients: ingredients.length === 0,
          needs_recipes: recipes.length === 0,
        },
      });
    } catch (err) {
      console.error("[agent-bridge] me failed:", err);
      res.status(500).json({ message: "Failed to load profile" });
    }
  });

  // Deterministic business snapshot — zero LLM cost, safe for any agent to
  // read as ground truth before advising the owner.
  app.get("/api/agent/summary", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const [ingredients, recipes, fullRecipes, wasteLogs] = await Promise.all([
        storage.getAllIngredients(userId),
        storage.getAllRecipes(userId),
        storage.getAllRecipesWithIngredients(userId),
        storage.getWasteLogs(userId, 200),
      ]);

      const inventoryValueCents = ingredients.reduce((sum: number, i: any) => {
        const qty = i.currentStock ?? 0;
        const perUnit = i.purchaseQuantity > 0 ? i.purchaseCost / i.purchaseQuantity : 0;
        return sum + Math.round(qty * perUnit * 100);
      }, 0);

      const priced = recipes.filter((r: any) => r.menuPrice && r.menuPrice > 0);
      const margins = priced
        .map((r: any) => ({ recipe: r, margin: marginOf(r) }))
        .filter((x: any) => x.margin !== null) as Array<{ recipe: any; margin: number }>;
      const avgMargin = margins.length ? margins.reduce((s, m) => s + m.margin, 0) / margins.length : null;
      const foodCostPct = priced.length
        ? priced.reduce((s, r: any) => s + (r.costPerServing ?? r.totalCost ?? 0) / r.menuPrice, 0) / priced.length * 100
        : null;

      const byMargin = [...margins].sort((a, b) => b.margin - a.margin);
      const byCost = [...recipes].sort((a: any, b: any) => (b.totalCost ?? 0) - (a.totalCost ?? 0));

      const lowStock = ingredients
        .filter((i: any) => i.currentStock != null && i.parValue != null && i.currentStock < i.parValue)
        .map((i: any) => ({
          ingredient_id: i.id,
          name: i.name,
          on_hand: i.currentStock,
          unit: i.purchaseUnit ?? "each",
          reorder_threshold: i.parValue,
          suggested_order_quantity: Math.max(0, (i.parValue ?? 0) - (i.currentStock ?? 0)),
        }));

      const usedIds = new Set<string>();
      for (const r of fullRecipes) for (const ri of r.ingredients ?? []) usedIds.add(ri.ingredientId);
      const missingDensity = ingredients.filter((i: any) => !i.isPackaging && !i.gramsPerMilliliter && usedIds.has(i.id)).map((i: any) => ({ id: i.id, name: i.name, purchase_unit: i.purchaseUnit }));

      const wasteByCost = new Map<string, { name: string; costCents: number; quantity: number; unit: string }>();
      for (const w of wasteLogs as any[]) {
        const key = w.ingredientId;
        const cur = wasteByCost.get(key) || { name: w.ingredient?.name ?? "Unknown", costCents: 0, quantity: 0, unit: w.unit ?? "units" };
        cur.costCents += Math.round((w.costAtTime ?? 0) * 100);
        cur.quantity += w.quantity ?? 0;
        wasteByCost.set(key, cur);
      }
      const topWaste = [...wasteByCost.values()].sort((a, b) => b.costCents - a.costCents).slice(0, 5);

      const storageBreakdown: Record<string, number> = {};
      for (const i of ingredients as any[]) {
        const s = i.storageType ?? "unspecified";
        storageBreakdown[s] = (storageBreakdown[s] ?? 0) + 1;
      }

      res.json({
        as_of: new Date().toISOString(),
        counts: {
          ingredients: ingredients.length,
          recipes: recipes.length,
          priced_recipes: priced.length,
          unpriced_recipes: recipes.length - priced.length,
        },
        menu: {
          avg_margin_pct: avgMargin != null ? Math.round(avgMargin * 10) / 10 : null,
          avg_food_cost_pct: foodCostPct != null ? Math.round(foodCostPct * 10) / 10 : null,
          top_margin_items: byMargin.slice(0, 5).map(({ recipe, margin }) => ({
            name: recipe.name, margin_pct: Math.round(margin * 10) / 10,
            cost_per_serving_cents: toCents(recipe.costPerServing), menu_price_cents: toCents(recipe.menuPrice),
          })),
          bottom_margin_items: byMargin.slice(-5).reverse().map(({ recipe, margin }) => ({
            name: recipe.name, margin_pct: Math.round(margin * 10) / 10,
            cost_per_serving_cents: toCents(recipe.costPerServing), menu_price_cents: toCents(recipe.menuPrice),
          })),
          most_expensive_items: byCost.slice(0, 5).map((r: any) => ({
            name: r.name, ingredient_cost_cents: toCents(r.totalCost), cost_per_serving_cents: toCents(r.costPerServing),
          })),
        },
        inventory: {
          value_cents: inventoryValueCents,
          low_stock: lowStock,
          storage_breakdown: storageBreakdown,
        },
        densities: {
          missing: missingDensity,
          missing_count: missingDensity.length,
        },
        waste: {
          events: (wasteLogs as any[]).length,
          total_cost_cents: [...wasteByCost.values()].reduce((s, w) => s + w.costCents, 0),
          top_items: topWaste,
        },
      });
    } catch (err) {
      console.error("[agent-bridge] summary failed:", err);
      res.status(500).json({ message: "Failed to load summary" });
    }
  });

  // ── Reads ───────────────────────────────────────────────────────────────

  app.get("/api/agent/recipes", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const recipes = await storage.getAllRecipes(userId);
      res.json(recipes.map(recipeOut));
    } catch (err) {
      console.error("[agent-bridge] recipes failed:", err);
      res.status(500).json({ message: "Failed to load recipes" });
    }
  });

  app.get("/api/agent/recipes/:id", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
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

  app.get("/api/agent/ingredients", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const ingredients = await storage.getAllIngredients(userId);
      res.json(ingredients.map(ingredientOut));
    } catch (err) {
      console.error("[agent-bridge] ingredients failed:", err);
      res.status(500).json({ message: "Failed to load ingredients" });
    }
  });

  // Stock levels (Kynda shape: MenuMetricsStock)
  app.get("/api/agent/stock", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
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
              (i.lastCountDate ?? i.lastUpdated ?? new Date()).toISOString?.() ?? String(i.lastUpdated),
          }))
      );
    } catch (err) {
      console.error("[agent-bridge] stock failed:", err);
      res.status(500).json({ message: "Failed to load stock" });
    }
  });

  // Recent waste logs (with ingredient cost context)
  app.get("/api/agent/waste", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);
      const logs = await storage.getWasteLogs(userId, limit);
      res.json(
        (logs as any[]).map((w) => ({
          id: w.id,
          ingredient_id: w.ingredientId,
          ingredient: w.ingredient?.name ?? null,
          quantity: w.quantity,
          unit: w.unit,
          reason: w.reason,
          notes: w.notes ?? null,
          cost_cents: toCents(w.costAtTime),
          employee: w.employeeName ?? null,
          wasted_at: w.wastedAt?.toISOString?.() ?? String(w.wastedAt),
        }))
      );
    } catch (err) {
      console.error("[agent-bridge] waste failed:", err);
      res.status(500).json({ message: "Failed to load waste logs" });
    }
  });

  // Global density reference (curated + user-added heuristics)
  app.get("/api/agent/density-heuristics", requireAgent, async (_req: any, res) => {
    try {
      const refs = await loadDensityHeuristics();
      res.json(
        refs.map((r: any) => ({
          ingredient: r.ingredientName,
          grams_per_milliliter: r.gramsPerMilliliter,
          category: r.category ?? null,
          notes: r.notes ?? null,
        }))
      );
    } catch (err) {
      console.error("[agent-bridge] density-heuristics failed:", err);
      res.status(500).json({ message: "Failed to load density references" });
    }
  });

  // Deterministic density suggestions for a list of names — no LLM needed.
  // GET /api/agent/density-heuristics/suggest?names=Milk,Flour&names=Sugar
  app.get("/api/agent/density-heuristics/suggest", requireAgent, async (req: any, res) => {
    try {
      const raw = req.query.names;
      const names = Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
      if (names.length === 0) return res.json({ suggestions: [] });
      const refs = await loadDensityHeuristics();
      const suggestions = names.map((name: string) => {
        const hit = suggestDensity(name, refs as any);
        return { name, ...(hit ? { suggestion: hit } : { suggestion: null, reason: "no_reference_match" }) };
      });
      res.json({ suggestions });
    } catch (err) {
      console.error("[agent-bridge] density suggest failed:", err);
      res.status(500).json({ message: "Failed to suggest densities" });
    }
  });

  // ── Ingredient writes ───────────────────────────────────────────────────

  // Create a single ingredient. Body: { name, category, store?, purchase_quantity,
  // purchase_unit, purchase_cost_cents, grams_per_milliliter? }
  app.post("/api/agent/ingredients", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const b = req.body ?? {};
      const parsed = insertIngredientSchema.parse({
        name: String(b.name ?? "").trim(),
        category: String(b.category ?? "other").trim(),
        ...(b.store != null ? { store: String(b.store) } : {}),
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

  // Bulk create ingredients (Excel-style JSON). Per-row isolation: bad rows are
  // reported, good rows are created.
  // Body: { ingredients: [{ name, category?, store?, purchase_quantity, purchase_unit,
  //        purchase_cost_cents, grams_per_milliliter?, price_per_unit_cents? }] }
  app.post("/api/agent/ingredients/bulk", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const rows = Array.isArray(req.body?.ingredients) ? req.body.ingredients : [];
      if (rows.length === 0) return res.status(400).json({ message: "ingredients[] is required" });
      const created: Array<{ id: string; name: string }> = [];
      const errors: Array<{ row: number; name?: string; error: string }> = [];
      for (let i = 0; i < rows.length; i++) {
        const b = rows[i] ?? {};
        try {
          const parsed = insertIngredientSchema.parse({
            name: String(b.name ?? "").trim(),
            category: String(b.category ?? "other").trim(),
            ...(b.store != null ? { store: String(b.store) } : {}),
            purchaseQuantity: Number(b.purchase_quantity),
            purchaseUnit: canonicalUnit(b.purchase_unit),
            purchaseCost: Number(b.purchase_cost_cents ?? 0) / 100,
            ...(b.price_per_unit_cents != null ? { pricePerUnit: Number(b.price_per_unit_cents) / 100 } : {}),
            ...(b.grams_per_milliliter != null
              ? { gramsPerMilliliter: Number(b.grams_per_milliliter), densitySource: b.density_source ?? "agent" }
              : {}),
            ...(b.yield_percentage != null ? { yieldPercentage: Number(b.yield_percentage) } : {}),
          });
          const ingredient = await storage.createIngredient(parsed, userId);
          created.push({ id: ingredient.id, name: ingredient.name });
        } catch (err: any) {
          errors.push({ row: i + 1, name: b.name, error: err?.message?.slice?.(0, 200) ?? String(err) });
        }
      }
      res.status(201).json({
        created_count: created.length,
        error_count: errors.length,
        created,
        errors: errors.slice(0, 25),
      });
    } catch (err) {
      console.error("[agent-bridge] bulk ingredients failed:", err);
      res.status(500).json({ message: "Bulk import failed" });
    }
  });

  // Import ingredients from an Excel workbook (multipart "file"). Column names
  // are auto-detected (name/category/store/quantity/unit/cost/density/yield).
  app.post("/api/agent/ingredients/import", requireAgent, bridgeUpload.single("file"), async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      if (!req.file) return res.status(400).json({ message: "No file uploaded (multipart field 'file')" });
      const rows = await parseIngredientWorkbook(Buffer.from(req.file.buffer));
      if (rows.length === 0) return res.status(400).json({ message: "Workbook has no data rows" });
      const created: Array<{ row: number; name: string }> = [];
      const errors: Array<{ row: number; error: string }> = [];
      for (let i = 0; i < rows.length; i++) {
        const m = mapRow(rows[i]);
        try {
          if (!m.name) throw new Error("Missing required field: name");
          let purchaseQuantity = m.purchaseQuantity;
          let purchaseUnit = m.purchaseUnit ? canonicalUnit(m.purchaseUnit) : undefined;
          // Combined format support: "64oz", "1 lb", "16 fl oz"
          if (!purchaseUnit || purchaseQuantity === undefined) {
            const qRaw = rows[i]["purchase_quantity"] ?? rows[i]["quantity"] ?? rows[i]["qty"];
            if (qRaw != null && typeof qRaw === "string") {
              const parsed = parseQuantityUnit(qRaw);
              if (parsed) {
                purchaseQuantity = parsed.quantity;
                purchaseUnit = parsed.unit;
              }
            }
          }
          if (purchaseQuantity === undefined || purchaseQuantity <= 0) throw new Error("Missing or invalid purchase_quantity");
          if (!purchaseUnit) throw new Error("Missing or invalid purchase_unit");
          if (m.purchaseCost === undefined || m.purchaseCost < 0) throw new Error("Missing or invalid purchase_cost");
          const parsed = insertIngredientSchema.parse({
            name: m.name,
            category: String(m.category ?? "other"),
            ...(m.store ? { store: m.store } : {}),
            purchaseQuantity,
            purchaseUnit,
            purchaseCost: m.purchaseCost,
            ...(m.pricePerUnit != null ? { pricePerUnit: m.pricePerUnit } : {}),
            ...(m.gramsPerMilliliter != null ? { gramsPerMilliliter: m.gramsPerMilliliter, densitySource: "imported" } : {}),
            ...(m.yieldPercentage != null ? { yieldPercentage: m.yieldPercentage } : {}),
          });
          const ingredient = await storage.createIngredient(parsed, userId);
          created.push({ row: i + 2, name: ingredient.name });
        } catch (err: any) {
          errors.push({ row: i + 2, error: err?.message?.slice?.(0, 200) ?? String(err) });
        }
      }
      res.status(201).json({
        created_count: created.length,
        error_count: errors.length,
        created,
        errors: errors.slice(0, 25),
        message: `Imported ${created.length} ingredients${errors.length ? `, skipped ${errors.length} rows` : ""}`,
      });
    } catch (err) {
      console.error("[agent-bridge] excel import failed:", err);
      res.status(500).json({ message: "Failed to import workbook" });
    }
  });

  // Apply researched densities in bulk (the "fill in densities from known
  // values" workflow). Body: { densities: [{ id or name, grams_per_milliliter,
  // source? }] } — matches by id first, then case-insensitive name.
  app.post("/api/agent/ingredients/densities", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const rows = Array.isArray(req.body?.densities) ? req.body.densities : [];
      if (rows.length === 0) return res.status(400).json({ message: "densities[] is required" });
      const all = await storage.getAllIngredients(userId);
      const byId = new Map(all.map((i: any) => [i.id, i]));
      const byName = new Map(all.map((i: any) => [i.name.toLowerCase(), i]));
      const updated: Array<{ id: string; name: string; grams_per_milliliter: number }> = [];
      const errors: Array<{ row: number; name?: string; error: string }> = [];
      for (let i = 0; i < rows.length; i++) {
        const b = rows[i] ?? {};
        const gpm = Number(b.grams_per_milliliter);
        try {
          if (!Number.isFinite(gpm) || gpm <= 0) throw new Error("grams_per_milliliter must be a positive number");
          const ing = (b.id && byId.get(String(b.id))) || (b.name && byName.get(String(b.name).toLowerCase()));
          if (!ing) throw new Error("No matching ingredient (pass id or exact name)");
          const merged: any = { ...ing, gramsPerMilliliter: gpm, densitySource: b.source ?? "agent" };
          const updatedIng = await storage.updateIngredient(ing.id, merged, userId);
          if (!updatedIng) throw new Error("Update failed");
          updated.push({ id: ing.id, name: ing.name, grams_per_milliliter: gpm });
        } catch (err: any) {
          errors.push({ row: i + 1, name: b.name, error: err?.message?.slice?.(0, 200) ?? String(err) });
        }
      }
      res.json({ updated_count: updated.length, error_count: errors.length, updated, errors: errors.slice(0, 25) });
    } catch (err) {
      console.error("[agent-bridge] densities apply failed:", err);
      res.status(500).json({ message: "Failed to apply densities" });
    }
  });

  // Scoped ingredient patch — agents may update cost/purchase/stock/density
  // fields, never name/category. Body: { grams_per_milliliter?, density_source?,
  // purchase_cost_cents?, purchase_quantity?, purchase_unit?, price_per_unit_cents?,
  // yield_percentage?, current_stock?, par_value? }
  app.patch("/api/agent/ingredients/:id", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const ing = await storage.getIngredient(req.params.id, userId);
      if (!ing) return res.status(404).json({ message: "Not found" });
      const b = req.body ?? {};
      const merged: any = { ...ing };
      if (b.grams_per_milliliter !== undefined) {
        merged.gramsPerMilliliter = Number(b.grams_per_milliliter);
        merged.densitySource = b.density_source ?? "agent";
      }
      if (b.purchase_cost_cents !== undefined) merged.purchaseCost = Number(b.purchase_cost_cents) / 100;
      if (b.purchase_quantity !== undefined) merged.purchaseQuantity = Number(b.purchase_quantity);
      if (b.purchase_unit !== undefined) merged.purchaseUnit = canonicalUnit(b.purchase_unit);
      if (b.price_per_unit_cents !== undefined) merged.pricePerUnit = Number(b.price_per_unit_cents) / 100;
      if (b.yield_percentage !== undefined) merged.yieldPercentage = Number(b.yield_percentage);
      if (b.current_stock !== undefined || b.par_value !== undefined) {
        if (b.current_stock !== undefined) merged.currentStock = Number(b.current_stock);
        if (b.par_value !== undefined) merged.parValue = Number(b.par_value);
        await storage.updateIngredientStock(req.params.id, merged.currentStock ?? ing.currentStock ?? 0, userId);
        if (b.par_value !== undefined) {
          await storage.updateIngredientInventorySettings(req.params.id, { parValue: merged.parValue }, userId);
        }
      }
      const updated = await storage.updateIngredient(req.params.id, merged, userId);
      if (!updated) return res.status(404).json({ message: "Update failed" });
      res.json(ingredientOut(updated));
    } catch (err) {
      console.error("[agent-bridge] patch ingredient failed:", err);
      res.status(400).json({ message: "Invalid update" });
    }
  });

  // ── Recipe writes ────────────────────────────────────────────────────────

  // Create a recipe from agent-proposed lines (existing contract — Kynda).
  app.post("/api/agent/recipes", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const b = req.body ?? {};
      const category = mapCategory(b.category);
      const parsed = insertRecipeSchema.parse({
        name: String(b.name ?? "").trim(),
        description: `[agent] ${String(b.description ?? "proposed by AI agent").trim()}`.slice(0, 1000),
        category,
        servings: Number(b.servings ?? 1),
        ...(b.target_margin_pct != null ? { targetMargin: Number(b.target_margin_pct) } : {}),
        ...(b.menu_price_cents != null ? { menuPrice: Number(b.menu_price_cents) / 100 } : {}),
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

  // Import many recipes at once. Body: { recipes: [{ name, description?,
  // category?, servings?, menu_price_cents?, target_margin_pct?, ingredients:
  // [{ name | ingredient_id, quantity, unit }] }] }. Ingredient lines by name
  // fuzzy-match existing ingredients; unmatched names are auto-created using a
  // density suggestion, so a full menu import works in one call.
  app.post("/api/agent/recipes/import", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const rows = Array.isArray(req.body?.recipes) ? req.body.recipes : [];
      if (rows.length === 0) return res.status(400).json({ message: "recipes[] is required" });
      const userIngredients = await storage.getAllIngredients(userId);
      const densityRefs = await loadDensityHeuristics();
      const created: Array<{ id: string; name: string; cost_per_serving_cents: number; created_ingredients: string[]; line_errors: string[] }> = [];
      const errors: Array<{ row: number; name?: string; error: string }> = [];

      for (let i = 0; i < rows.length; i++) {
        const b = rows[i] ?? {};
        try {
          if (!b.name || typeof b.name !== "string") throw new Error("Recipe must have a 'name' field");
          const parsed = insertRecipeSchema.parse({
            name: b.name.trim(),
            description: `[agent] ${String(b.description ?? "").trim()}`.slice(0, 1000) || "[agent] imported",
            category: mapCategory(b.category),
            servings: Number(b.servings ?? 1),
            ...(b.target_margin_pct != null ? { targetMargin: Number(b.target_margin_pct) } : {}),
            ...(b.menu_price_cents != null ? { menuPrice: Number(b.menu_price_cents) / 100 } : {}),
          });
          const recipe = await storage.createRecipe(parsed, userId);
          const createdIngredients: string[] = [];
          const lineErrors: string[] = [];
          const lines = Array.isArray(b.ingredients) ? b.ingredients : [];

          for (const line of lines) {
            try {
              let ingredientId = line.ingredient_id ? String(line.ingredient_id) : null;
              if (!ingredientId && line.name) {
                const match = findBestMatch(String(line.name), userIngredients, {
                  autoMatchThreshold: 0.8,
                  minThreshold: 0.6,
                  useNormalization: true,
                });
                if (match) {
                  ingredientId = match.match.id;
                } else {
                  // Auto-create the missing ingredient with a suggested density.
                  const hit = suggestDensity(String(line.name), densityRefs as any);
                  const newIngData = insertIngredientSchema.parse({
                    name: String(line.name).trim().slice(0, 200),
                    category: "other",
                    purchaseQuantity: 1,
                    purchaseUnit: "units",
                    purchaseCost: 0,
                    ...(hit ? { gramsPerMilliliter: hit.grams_per_milliliter, densitySource: `heuristic:${hit.matched_name}` } : {}),
                  });
                  const newIng = await storage.createIngredient(newIngData, userId);
                  userIngredients.push(newIng);
                  createdIngredients.push(newIng.name);
                  ingredientId = newIng.id;
                }
              }
              if (!ingredientId) throw new Error("Ingredient line needs 'ingredient_id' or 'name'");
              const lineParsed = insertRecipeIngredientSchema.parse({
                recipeId: recipe.id,
                ingredientId,
                quantity: Number(line.quantity ?? 1),
                unit: canonicalUnit(line.unit ?? "units"),
              });
              await storage.createRecipeIngredient(lineParsed, userId);
            } catch (lineErr: any) {
              lineErrors.push(`${line.name ?? line.ingredient_id}: ${String(lineErr).slice(0, 120)}`);
            }
          }

          const recalced = await storage.recalculateRecipeCost(recipe.id, userId);
          created.push({
            id: recipe.id,
            name: recipe.name,
            cost_per_serving_cents: toCents(recalced?.costPerServing),
            created_ingredients: createdIngredients,
            line_errors: lineErrors,
          });
        } catch (err: any) {
          errors.push({ row: i + 1, name: b.name, error: err?.message?.slice?.(0, 200) ?? String(err) });
        }
      }

      res.status(201).json({
        created_count: created.length,
        error_count: errors.length,
        created,
        errors: errors.slice(0, 25),
      });
    } catch (err) {
      console.error("[agent-bridge] recipes import failed:", err);
      res.status(500).json({ message: "Failed to import recipes" });
    }
  });

  // Apply pricing to a recipe (agent can implement its own recommendations).
  // Body: { menu_price_cents?, target_margin_pct?, waste_percentage?, consumables_buffer_cents? }
  app.patch("/api/agent/recipes/:id/pricing", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const b = req.body ?? {};
      const pricing: any = {};
      if (b.menu_price_cents !== undefined) pricing.menuPrice = Number(b.menu_price_cents) / 100;
      if (b.target_margin_pct !== undefined) pricing.targetMargin = Number(b.target_margin_pct);
      if (b.waste_percentage !== undefined) pricing.wastePercentage = Number(b.waste_percentage);
      if (b.consumables_buffer_cents !== undefined) pricing.consumablesBuffer = Number(b.consumables_buffer_cents) / 100;
      if (Object.keys(pricing).length === 0) return res.status(400).json({ message: "No pricing fields provided" });
      const updated = await storage.updateRecipePricing(req.params.id, pricing, userId);
      if (!updated) return res.status(404).json({ message: "Not found" });
      const out = recipeOut(updated);
      res.json({ ...out, pricing: priceRecommendation(out.cost_per_serving_cents, out.target_margin_pct) });
    } catch (err) {
      console.error("[agent-bridge] recipe pricing failed:", err);
      res.status(400).json({ message: "Invalid pricing update" });
    }
  });

  // ── Agent insights (deterministic + optional LLM narrative) ─────────────

  // POST /api/agent/insights  Body: { focus?: "menu"|"costs"|"pricing"|"waste"|"seasonal",
  // include_narrative?: boolean, custom_prompt?: string }
  // Returns deterministic recommendations computed from the user's real data,
  // plus (when include_narrative) an LLM-written narrative via the user's
  // configured AI provider.
  app.post("/api/agent/insights", requireAgent, async (req: any, res) => {
    try {
      const userId = req.agentIdentity.userId;
      const body = req.body ?? {};
      const focus = String(body.focus ?? "menu");
      const includeNarrative = body.include_narrative !== false;

      const [ingredients, recipes, fullRecipes, wasteLogs] = await Promise.all([
        storage.getAllIngredients(userId),
        storage.getAllRecipes(userId),
        storage.getAllRecipesWithIngredients(userId),
        storage.getWasteLogs(userId, 200),
      ]);

      const recommendations: Array<{ type: string; priority: "high" | "medium" | "low"; title: string; detail: string; action?: any }> = [];

      // 1. Unpriced recipes — biggest blind spot.
      const unpriced = recipes.filter((r: any) => !r.menuPrice || r.menuPrice <= 0);
      if (unpriced.length > 0) {
        recommendations.push({
          type: "pricing",
          priority: "high",
          title: `${unpriced.length} recipe${unpriced.length > 1 ? "s" : ""} ha${unpriced.length > 1 ? "ve" : "s"} no menu price`,
          detail: unpriced.slice(0, 5).map((r: any) => `${r.name} (cost $${(r.costPerServing ?? 0).toFixed(2)})`).join("; ") + (unpriced.length > 5 ? ` +${unpriced.length - 5} more` : ""),
          action: {
            method: "PATCH",
            path: "/api/agent/recipes/{id}/pricing",
            params: ["menu_price_cents", "target_margin_pct"],
          },
        });
      }

      // 2. Density gaps on used ingredients.
      const usedIds = new Set<string>();
      for (const r of fullRecipes) for (const ri of r.ingredients ?? []) usedIds.add(ri.ingredientId);
      const missingDensity = ingredients.filter((i: any) => !i.isPackaging && !i.gramsPerMilliliter && usedIds.has(i.id));
      if (missingDensity.length > 0) {
        recommendations.push({
          type: "data_quality",
          priority: "high",
          title: `${missingDensity.length} ingredient${missingDensity.length > 1 ? "s" : ""} used in recipes lack a density value`,
          detail: "Weight↔volume conversions may be inaccurate, which skews recipe costs. " + missingDensity.slice(0, 5).map((i: any) => i.name).join(", "),
          action: {
            method: "POST",
            path: "/api/agent/ingredients/densities",
            hint: "Look up known densities (USDA/package labels), then POST { densities: [{ id, grams_per_milliliter }] }",
          },
        });
      }

      // 3. Margin analysis (if pricing exists).
      const priced = recipes.filter((r: any) => r.menuPrice && r.menuPrice > 0);
      const margins = priced
        .map((r: any) => ({ recipe: r, margin: marginOf(r) }))
        .filter((x: any) => x.margin !== null) as Array<{ recipe: any; margin: number }>;
      if (margins.length > 0) {
        const avg = margins.reduce((s, m) => s + m.margin, 0) / margins.length;
        const low = margins.filter((m) => m.margin < 25);
        if (low.length > 0) {
          recommendations.push({
            type: "pricing",
            priority: "high",
            title: `${low.length} item${low.length > 1 ? "s" : ""} below 25% margin`,
            detail: low.slice(0, 5).map((m) => `${m.recipe.name} (${m.margin.toFixed(1)}%)`).join("; "),
            action: { method: "PATCH", path: "/api/agent/recipes/{id}/pricing", params: ["menu_price_cents"] },
          });
        }
        recommendations.push({
          type: "menu",
          priority: "medium",
          title: `Average menu margin is ${avg.toFixed(1)}%`,
          detail: `Healthiest items: ${margins.sort((a, b) => b.margin - a.margin).slice(0, 3).map((m) => `${m.recipe.name} (${m.margin.toFixed(0)}%)`).join(", ")}`,
        });
      }

      // 4. Low stock.
      const lowStock = ingredients.filter((i: any) => i.currentStock != null && i.parValue != null && i.currentStock < i.parValue);
      if (lowStock.length > 0) {
        recommendations.push({
          type: "inventory",
          priority: "high",
          title: `${lowStock.length} ingredient${lowStock.length > 1 ? "s" : ""} below reorder threshold`,
          detail: lowStock.slice(0, 8).map((i: any) => `${i.name} (${i.currentStock}/${i.parValue} ${i.purchaseUnit})`).join("; "),
          action: { method: "GET", path: "/api/agent/stock" },
        });
      }

      // 5. Waste (if any).
      const wasteTotal = wasteLogs.reduce((s: number, w: any) => s + (w.costAtTime ?? 0), 0);
      if (wasteLogs.length > 0) {
        const byReason = new Map<string, number>();
        for (const w of wasteLogs as any[]) byReason.set(w.reason, (byReason.get(w.reason) ?? 0) + (w.costAtTime ?? 0));
        const topReason = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0];
        recommendations.push({
          type: "waste",
          priority: "medium",
          title: `$${wasteTotal.toFixed(2)} in logged waste across ${wasteLogs.length} event${wasteLogs.length > 1 ? "s" : ""}`,
          detail: topReason ? `Biggest driver: ${topReason[0]} ($${topReason[1].toFixed(2)})` : "No reason breakdown available",
          action: { method: "GET", path: "/api/agent/waste" },
        });
      }

      // 6. Seasonal opportunity (based on actual category mix).
      const categories = new Set(recipes.map((r: any) => r.category));
      if (!categories.has("seasonal_drink") && !categories.has("seasonal_food")) {
        recommendations.push({
          type: "seasonal",
          priority: "low",
          title: "No seasonal items on the menu",
          detail: "Limited-time seasonal drinks/food typically carry 70%+ margins and drive trial. Consider adding one seasonal drink and one seasonal food item.",
          action: { method: "POST", path: "/api/agent/recipes", hint: "Create a recipe with category=seasonal_drink" },
        });
      }

      const filtered = focus === "all" ? recommendations : recommendations.filter((r) => r.type === focus);

      let narrative: string | null = null;
      if (includeNarrative && filtered.length > 0) {
        const settings = await storage.getAISettings(userId);
        const provider = (settings?.aiProvider || "openai") as AIProvider;
        const canUse = await storage.canUseAi(userId);
        if (canUse) {
          const summaryJson = JSON.stringify(
            {
              focus,
              counts: { ingredients: ingredients.length, recipes: recipes.length },
              recommendations: filtered,
            },
            null,
            2
          );
          const userPrompt = body.custom_prompt
            ? `The owner asked: "${body.custom_prompt}"\n\n`
            : "";
          narrative = await callAI({
            provider,
            prompt: `${userPrompt}Act as a practical small-business food-service advisor. Turn these data-driven findings into 3-6 plain-English recommendations the owner can act on today. Be specific, mention item names and dollar figures, and prefer the cheapest actionable wins first:\n\n${summaryJson}`,
            systemPrompt: "You are MenuMetrics' business advisor. Respond in concise markdown with short sections. Do not invent data that is not present.",
          });
        } else {
          narrative = null;
        }
      }

      res.json({
        focus,
        recommendations: filtered,
        narrative,
        narrative_available: includeNarrative && narrative !== null,
      });
    } catch (err) {
      console.error("[agent-bridge] insights failed:", err);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });
}

/** Tolerant category mapping for agent input. */
function mapCategory(raw: unknown): string {
  const s = String(raw ?? "other").toLowerCase().trim();
  if (["food", "drink", "seasonal_food", "seasonal_drink", "other"].includes(s)) return s;
  if (["beverage", "coffee", "espresso", "tea", "smoothie", "latte", "cold_brew", "espresso_drinks", "tea_drinks", "blended_drinks"].some((k) => s.includes(k))) return "drink";
  if (["pastry", "sandwich", "breakfast", "lunch", "bakery", "snack", "baked_goods"].some((k) => s.includes(k))) return "food";
  return "other";
}

// ── OpenAPI 3.0.3 spec (hand-maintained; mirrors the routes above) ─────────

function buildOpenApiSpec() {
  const bearer = {
    type: "http",
    scheme: "bearer",
    description: "Per-user key (mm_...) from Settings → Agent API, or global AGENT_BRIDGE_TOKEN (self-host). Also accepts X-Agent-Token header.",
  } as const;
  return {
    openapi: "3.0.3",
    info: {
      title: "MenuMetrics Agent API",
      version: "3.0.0",
      description:
        "Token-protected API for agents to read business data (costs, margins, inventory, waste) and write ingredients/recipes/densities. Money is in cents (snake_case). Companion skill: 'menumetrics-agent' for Hermes Agent.",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: { bearerAuth: bearer, xAgentToken: { type: "apiKey", in: "header", name: "X-Agent-Token" } },
      schemas: {
        Error: { type: "object", properties: { message: { type: "string" } } },
        Recipe: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            category: { type: "string" },
            yield_servings: { type: "number" },
            cost_per_serving_cents: { type: "integer" },
            ingredient_cost_cents: { type: "integer" },
            menu_price_cents: { type: ["integer", "null"] },
            target_margin_pct: { type: "number" },
            waste_percentage: { type: "number" },
            updated_at: { type: "string" },
          },
        },
        Ingredient: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            vendor: { type: ["string", "null"] },
            pack_size: { type: ["string", "null"] },
            cost_cents: { type: "integer" },
            unit: { type: "string" },
            density_g_per_ml: { type: ["number", "null"] },
            density_source: { type: ["string", "null"] },
            yield_percentage: { type: "number" },
            updated_at: { type: "string" },
          },
        },
        IngredientInput: {
          type: "object",
          required: ["name", "purchase_quantity", "purchase_unit", "purchase_cost_cents"],
          properties: {
            name: { type: "string" },
            category: { type: "string", default: "other" },
            store: { type: "string" },
            purchase_quantity: { type: "number" },
            purchase_unit: { type: "string", description: "grams, kg, ounces, pounds, cups, tbsp, tsp, ml, liters, pints, quarts, gallons, units" },
            purchase_cost_cents: { type: "integer" },
            price_per_unit_cents: { type: "integer" },
            grams_per_milliliter: { type: "number" },
            yield_percentage: { type: "number", default: 97 },
          },
        },
        DensityApply: {
          type: "object",
          required: ["grams_per_milliliter"],
          properties: {
            id: { type: "string" },
            name: { type: "string", description: "Exact name, used when id is omitted" },
            grams_per_milliliter: { type: "number" },
            source: { type: "string", description: "e.g. USDA, package label, heuristic:Whole Milk" },
          },
        },
        RecipeImport: {
          type: "object",
          required: ["name", "ingredients"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            category: { type: "string", enum: ["food", "drink", "seasonal_food", "seasonal_drink", "other"] },
            servings: { type: "number", default: 1 },
            menu_price_cents: { type: "integer" },
            target_margin_pct: { type: "number" },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                required: ["quantity", "unit"],
                properties: {
                  name: { type: "string", description: "Fuzzy-matched to inventory; auto-created if absent" },
                  ingredient_id: { type: "string" },
                  quantity: { type: "number" },
                  unit: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }, { xAgentToken: [] }],
    paths: {
      "/api/agent/health": { get: { summary: "Liveness + auth modes", responses: { "200": { description: "OK" } } } },
      "/api/agent/openapi.json": { get: { summary: "This specification", responses: { "200": { description: "OpenAPI 3.0.3 JSON" } } } },
      "/api/agent/me": { get: { summary: "Profile + onboarding checklist", responses: { "200": { description: "User, counts, missing densities, unpriced recipes" } } } },
      "/api/agent/summary": { get: { summary: "Deterministic business snapshot (no LLM)", responses: { "200": { description: "Menu margins, inventory value, low stock, waste, density gaps" } } } },
      "/api/agent/recipes": {
        get: { summary: "List recipes with costs", responses: { "200": { description: "Array of Recipe" } } },
        post: { summary: "Create a recipe", requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/RecipeImport" } } } }, responses: { "201": { description: "Recipe with pricing recommendation" } } },
      },
      "/api/agent/recipes/{id}": { get: { summary: "Recipe with ingredients + price recommendation", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Recipe detail" }, "404": { description: "Not found" } } } },
      "/api/agent/recipes/import": { post: { summary: "Bulk import recipes (auto-creates missing ingredients)", requestBody: { content: { "application/json": { schema: { type: "object", required: ["recipes"], properties: { recipes: { type: "array", items: { $ref: "#/components/schemas/RecipeImport" } } } } } } }, responses: { "201": { description: "Import results" } } } },
      "/api/agent/recipes/{id}/pricing": { patch: { summary: "Apply pricing fields", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { menu_price_cents: { type: "integer" }, target_margin_pct: { type: "number" }, waste_percentage: { type: "number" }, consumables_buffer_cents: { type: "integer" } } } } } }, responses: { "200": { description: "Updated recipe" } } } },
      "/api/agent/ingredients": {
        get: { summary: "List ingredients", responses: { "200": { description: "Array of Ingredient" } } },
        post: { summary: "Create one ingredient", requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/IngredientInput" } } } }, responses: { "201": { description: "Created" } } },
      },
      "/api/agent/ingredients/bulk": { post: { summary: "Bulk create ingredients (per-row isolation)", requestBody: { content: { "application/json": { schema: { type: "object", required: ["ingredients"], properties: { ingredients: { type: "array", items: { $ref: "#/components/schemas/IngredientInput" } } } } } } }, responses: { "201": { description: "created_count + per-row errors" } } } },
      "/api/agent/ingredients/import": { post: { summary: "Import ingredients from Excel (.xlsx multipart 'file')", requestBody: { content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } } }, responses: { "201": { description: "Import results" } } } },
      "/api/agent/ingredients/densities": { post: { summary: "Apply researched densities in bulk", requestBody: { content: { "application/json": { schema: { type: "object", required: ["densities"], properties: { densities: { type: "array", items: { $ref: "#/components/schemas/DensityApply" } } } } } } }, responses: { "200": { description: "updated_count + errors" } } } },
      "/api/agent/ingredients/{id}": { patch: { summary: "Scoped update (density, purchase, stock, yield — never name/category)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { grams_per_milliliter: { type: "number" }, density_source: { type: "string" }, purchase_cost_cents: { type: "integer" }, purchase_quantity: { type: "number" }, purchase_unit: { type: "string" }, price_per_unit_cents: { type: "integer" }, yield_percentage: { type: "number" }, current_stock: { type: "number" }, par_value: { type: "number" } } } } } }, responses: { "200": { description: "Updated Ingredient" } } } },
      "/api/agent/stock": { get: { summary: "Stock levels + reorder thresholds", responses: { "200": { description: "Array of stock rows" } } } },
      "/api/agent/waste": { get: { summary: "Recent waste logs", responses: { "200": { description: "Array of waste events" } } } },
      "/api/agent/density-heuristics": { get: { summary: "Global density reference table", responses: { "200": { description: "Array of { ingredient, grams_per_milliliter, category }" } } } },
      "/api/agent/density-heuristics/suggest": { get: { summary: "Fuzzy density suggestions by name", parameters: [{ name: "names", in: "query", required: true, schema: { type: "string" }, description: "Comma-separated ingredient names" }], responses: { "200": { description: "Suggestions" } } } },
      "/api/agent/insights": { post: { summary: "Deterministic recommendations + optional LLM narrative", requestBody: { content: { "application/json": { schema: { type: "object", properties: { focus: { type: "string", enum: ["menu", "costs", "pricing", "waste", "seasonal", "inventory", "data_quality", "all"] }, include_narrative: { type: "boolean", default: true }, custom_prompt: { type: "string" } } } } } }, responses: { "200": { description: "recommendations[] + narrative" } } } },
    },
  };
}
