/**
 * One-time data restoration: copies jpkorstad@gmail.com data from NEON database
 * into the current DATABASE_URL (production Replit database).
 *
 * Tables restored: ingredients, recipes, recipe_ingredients, recipe_sub_ingredients,
 *                  category_pricing_settings, waste_logs, density_heuristics (missing rows only)
 *
 * Safe to run multiple times — all inserts use ON CONFLICT DO NOTHING.
 * Uses a completion gate (checks ALL target tables) to avoid skip-on-partial-failure.
 */

import pg from "pg";

const { Pool } = pg;
const JPKORSTAD_USER_ID = "12346030";
const KYNDACOFFEE_USER_ID = "49824742";

interface RestorationCounts {
  ingredients: number;
  recipes: number;
  recipeIngredients: number;
  recipeSubIngredients: number;
  categoryPricingSettings: number;
  wasteLogs: number;
}

async function getUserCounts(pool: pg.Pool, userId: string): Promise<RestorationCounts> {
  const [ing, rec, ri, rsi, cp, wl] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS n FROM ingredients WHERE user_id = $1", [userId]),
    pool.query("SELECT COUNT(*)::int AS n FROM recipes WHERE user_id = $1", [userId]),
    pool.query("SELECT COUNT(*)::int AS n FROM recipe_ingredients WHERE user_id = $1", [userId]),
    pool.query("SELECT COUNT(*)::int AS n FROM recipe_sub_ingredients WHERE user_id = $1", [userId]),
    pool.query("SELECT COUNT(*)::int AS n FROM category_pricing_settings WHERE user_id = $1", [userId]),
    pool.query("SELECT COUNT(*)::int AS n FROM waste_logs WHERE user_id = $1", [userId]),
  ]);
  return {
    ingredients: ing.rows[0].n,
    recipes: rec.rows[0].n,
    recipeIngredients: ri.rows[0].n,
    recipeSubIngredients: rsi.rows[0].n,
    categoryPricingSettings: cp.rows[0].n,
    wasteLogs: wl.rows[0].n,
  };
}

function isComplete(dest: RestorationCounts, src: RestorationCounts): boolean {
  return (
    dest.ingredients >= src.ingredients &&
    dest.recipes >= src.recipes &&
    dest.recipeIngredients >= src.recipeIngredients &&
    dest.recipeSubIngredients >= src.recipeSubIngredients &&
    dest.categoryPricingSettings >= src.categoryPricingSettings &&
    dest.wasteLogs >= src.wasteLogs
  );
}

export async function restoreJpkorstad(): Promise<void> {
  const neonUrl = process.env.NEON_DATABASE_URL;
  const localUrl = process.env.DATABASE_URL;

  if (!neonUrl || neonUrl === localUrl) {
    console.log("[migration] Skipping restore: NEON_DATABASE_URL not set or matches DATABASE_URL");
    return;
  }

  const sslLocal = localUrl?.includes("neon.tech") ? { rejectUnauthorized: false } : undefined;
  const destPool = new Pool({ connectionString: localUrl, ssl: sslLocal });

  try {
    // --- Pre-flight: verify user exists in destination ---
    const userRow = await destPool.query(
      "SELECT id, email FROM users WHERE id = $1",
      [JPKORSTAD_USER_ID]
    );
    if (userRow.rows.length === 0) {
      console.log("[migration] jpkorstad user not found in production DB — skipping");
      return;
    }

    // --- Pre-flight: guard kyndacoffee data (must remain 166) ---
    const kyndaBefore = await destPool.query(
      "SELECT COUNT(*)::int AS n FROM ingredients WHERE user_id = $1",
      [KYNDACOFFEE_USER_ID]
    );
    const kyndaBeforeCount: number = kyndaBefore.rows[0].n;
    console.log(`[migration] kyndacoffee ingredients (pre-check): ${kyndaBeforeCount}`);

    // Connect to NEON source
    const neonPool = new Pool({
      connectionString: neonUrl,
      ssl: { rejectUnauthorized: false },
    });

    try {
      // --- Get source counts from NEON ---
      const srcCounts = await getUserCounts(neonPool, JPKORSTAD_USER_ID);
      console.log("[migration] Source (NEON) counts for jpkorstad:", srcCounts);

      // --- Get destination counts ---
      const destCountsBefore = await getUserCounts(destPool, JPKORSTAD_USER_ID);
      console.log("[migration] Destination (prod) counts BEFORE:", destCountsBefore);

      // --- Completion gate: skip only if ALL tables are already at or above source counts ---
      if (isComplete(destCountsBefore, srcCounts)) {
        console.log("[migration] All data already present in production — skipping restore");
        return;
      }

      console.log("[migration] Incomplete or missing data detected — running restore...");

      await copyData(neonPool, destPool, srcCounts);

      // --- Post-restore verification ---
      const destCountsAfter = await getUserCounts(destPool, JPKORSTAD_USER_ID);
      console.log("[migration] Destination (prod) counts AFTER:", destCountsAfter);

      // --- Verify kyndacoffee is untouched ---
      const kyndaAfter = await destPool.query(
        "SELECT COUNT(*)::int AS n FROM ingredients WHERE user_id = $1",
        [KYNDACOFFEE_USER_ID]
      );
      const kyndaAfterCount: number = kyndaAfter.rows[0].n;
      if (kyndaAfterCount !== kyndaBeforeCount) {
        console.error(
          `[migration] WARNING: kyndacoffee ingredient count changed! ${kyndaBeforeCount} → ${kyndaAfterCount}`
        );
      } else {
        console.log(`[migration] kyndacoffee ingredients preserved: ${kyndaAfterCount} (unchanged)`);
      }

      // --- Final summary ---
      console.log("[migration] === RESTORATION SUMMARY ===");
      const tables = ["ingredients", "recipes", "recipeIngredients", "recipeSubIngredients", "categoryPricingSettings", "wasteLogs"] as const;
      for (const table of tables) {
        const inserted = (destCountsAfter[table] as number) - (destCountsBefore[table] as number);
        console.log(`[migration]   ${table}: ${destCountsBefore[table]} → ${destCountsAfter[table]} (+${inserted} inserted)`);
      }

      if (isComplete(destCountsAfter, srcCounts)) {
        console.log("[migration] COMPLETE — all jpkorstad data successfully restored to production");
      } else {
        console.error("[migration] PARTIAL — some counts did not reach expected values. May need manual review.");
      }
    } finally {
      await neonPool.end();
    }
  } finally {
    await destPool.end();
  }
}

async function copyData(src: pg.Pool, dest: pg.Pool, srcCounts: RestorationCounts): Promise<void> {
  // --- Fetch all source data ---
  const ingredients = await src.query<{
    id: string; user_id: string; name: string; category: string; store: string | null;
    purchase_quantity: number; purchase_unit: string; purchase_cost: number;
    price_per_unit: number | null; grams_per_milliliter: number | null; density_source: string | null;
    is_packaging: boolean; is_addition: boolean;
    addition_portion_size: number | null; addition_portion_unit: string | null;
    addition_menu_price: number | null; addition_base_ingredient_id: string | null;
    addition_base_portion_ratio: number | null; yield_percentage: number;
    par_value: number | null; current_stock: number | null; storage_type: string | null;
    count_frequency: string | null; last_count_date: Date | null;
    cost_per_ounce: number | null; cost_per_gram: number | null; cost_per_cup: number | null;
    cost_per_tbsp: number | null; cost_per_tsp: number | null; cost_per_pound: number | null;
    cost_per_kg: number | null; cost_per_liter: number | null; cost_per_ml: number | null;
    cost_per_pint: number | null; cost_per_quart: number | null; cost_per_gallon: number | null;
    cost_per_unit: number | null; last_updated: Date;
  }>(
    "SELECT * FROM ingredients WHERE user_id = $1",
    [JPKORSTAD_USER_ID]
  );

  const recipes = await src.query<{
    id: string; user_id: string; name: string; description: string | null; category: string;
    servings: number; total_cost: number; cost_per_serving: number; menu_price: number | null;
    waste_percentage: number; target_margin: number; consumables_buffer: number;
    is_packaging_preset: boolean; is_base_recipe: boolean; created_at: Date;
  }>(
    "SELECT * FROM recipes WHERE user_id = $1",
    [JPKORSTAD_USER_ID]
  );

  const recipeIds = recipes.rows.map((r) => r.id);
  let recipeIngredients: pg.QueryResult<{
    id: string; user_id: string; recipe_id: string; ingredient_id: string; quantity: number; unit: string;
  }> = { rows: [], command: "", rowCount: 0, oid: 0, fields: [] };
  let recipeSubIngredients: pg.QueryResult<{
    id: string; user_id: string; recipe_id: string; sub_recipe_id: string; quantity: number;
  }> = { rows: [], command: "", rowCount: 0, oid: 0, fields: [] };

  if (recipeIds.length > 0) {
    const placeholders = recipeIds.map((_, i) => `$${i + 1}`).join(",");
    recipeIngredients = await src.query(
      `SELECT * FROM recipe_ingredients WHERE recipe_id IN (${placeholders})`,
      recipeIds
    );
    recipeSubIngredients = await src.query(
      `SELECT * FROM recipe_sub_ingredients WHERE recipe_id IN (${placeholders})`,
      recipeIds
    );
  }

  const categorySettings = await src.query<{
    id: string; user_id: string; category: string; waste_percentage: number;
    target_margin: number; updated_at: Date;
  }>(
    "SELECT * FROM category_pricing_settings WHERE user_id = $1",
    [JPKORSTAD_USER_ID]
  );

  const wasteLogs = await src.query<{
    id: string; user_id: string; ingredient_id: string; quantity: number; unit: string;
    reason: string; notes: string | null; cost_at_time: number; wasted_at: Date; created_at: Date;
  }>(
    "SELECT * FROM waste_logs WHERE user_id = $1",
    [JPKORSTAD_USER_ID]
  );

  // Density heuristics: only copy rows missing from destination
  const srcDensities = await src.query<{
    id: string; ingredient_name: string; grams_per_milliliter: number;
    category: string | null; notes: string | null; last_updated: Date;
  }>("SELECT * FROM density_heuristics");

  const destDensityNames = await dest.query<{ ingredient_name: string }>(
    "SELECT ingredient_name FROM density_heuristics"
  );
  const destDensityNameSet = new Set(destDensityNames.rows.map((r) => r.ingredient_name));
  const missingDensities = srcDensities.rows.filter((r) => !destDensityNameSet.has(r.ingredient_name));

  console.log(`[migration] Data to copy: ${ingredients.rows.length} ingredients, ${recipes.rows.length} recipes, ` +
    `${recipeIngredients.rows.length} recipe_ingredients, ${recipeSubIngredients.rows.length} recipe_sub_ingredients, ` +
    `${categorySettings.rows.length} category_pricing_settings, ${wasteLogs.rows.length} waste_logs, ` +
    `${missingDensities.length} missing density_heuristics`);

  // --- Insert density_heuristics (missing only) ---
  let densityInserted = 0;
  for (const d of missingDensities) {
    const result = await dest.query(
      `INSERT INTO density_heuristics (id, ingredient_name, grams_per_milliliter, category, notes, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [d.id, d.ingredient_name, d.grams_per_milliliter, d.category, d.notes, d.last_updated]
    );
    if (result.rowCount && result.rowCount > 0) densityInserted++;
  }
  console.log(`[migration] density_heuristics: inserted ${densityInserted}`);

  // --- Insert ingredients (two passes for self-referential FK) ---
  const sortedIngredients = [...ingredients.rows].sort((a, b) => {
    if (a.addition_base_ingredient_id && !b.addition_base_ingredient_id) return 1;
    if (!a.addition_base_ingredient_id && b.addition_base_ingredient_id) return -1;
    return 0;
  });

  let ingInserted = 0;
  for (const ing of sortedIngredients) {
    const result = await dest.query(
      `INSERT INTO ingredients (
        id, user_id, name, category, store,
        purchase_quantity, purchase_unit, purchase_cost,
        price_per_unit, grams_per_milliliter, density_source,
        is_packaging, is_addition,
        addition_portion_size, addition_portion_unit, addition_menu_price,
        addition_base_ingredient_id, addition_base_portion_ratio,
        yield_percentage,
        par_value, current_stock, storage_type, count_frequency, last_count_date,
        cost_per_ounce, cost_per_gram, cost_per_cup, cost_per_tbsp, cost_per_tsp,
        cost_per_pound, cost_per_kg, cost_per_liter, cost_per_ml,
        cost_per_pint, cost_per_quart, cost_per_gallon, cost_per_unit,
        last_updated
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11,
        $12, $13,
        $14, $15, $16,
        NULL, $17,
        $18,
        $19, $20, $21, $22, $23,
        $24, $25, $26, $27, $28,
        $29, $30, $31, $32,
        $33, $34, $35, $36,
        $37
      )
      ON CONFLICT (id) DO NOTHING`,
      [
        ing.id, ing.user_id, ing.name, ing.category, ing.store,
        ing.purchase_quantity, ing.purchase_unit, ing.purchase_cost,
        ing.price_per_unit, ing.grams_per_milliliter, ing.density_source,
        ing.is_packaging, ing.is_addition,
        ing.addition_portion_size, ing.addition_portion_unit, ing.addition_menu_price,
        ing.addition_base_portion_ratio ?? 1.0,
        ing.yield_percentage ?? 97,
        ing.par_value, ing.current_stock, ing.storage_type, ing.count_frequency, ing.last_count_date,
        ing.cost_per_ounce, ing.cost_per_gram, ing.cost_per_cup, ing.cost_per_tbsp, ing.cost_per_tsp,
        ing.cost_per_pound, ing.cost_per_kg, ing.cost_per_liter, ing.cost_per_ml,
        ing.cost_per_pint, ing.cost_per_quart, ing.cost_per_gallon, ing.cost_per_unit,
        ing.last_updated,
      ]
    );
    if (result.rowCount && result.rowCount > 0) ingInserted++;
  }

  // Second pass: restore self-referential addition_base_ingredient_id
  const withBaseRef = ingredients.rows.filter((i) => i.addition_base_ingredient_id !== null);
  for (const ing of withBaseRef) {
    await dest.query(
      "UPDATE ingredients SET addition_base_ingredient_id = $1 WHERE id = $2 AND user_id = $3",
      [ing.addition_base_ingredient_id, ing.id, JPKORSTAD_USER_ID]
    );
  }
  console.log(`[migration] ingredients: inserted ${ingInserted} (${withBaseRef.length} self-refs updated)`);

  // --- Insert recipes ---
  let recInserted = 0;
  for (const rec of recipes.rows) {
    const result = await dest.query(
      `INSERT INTO recipes (
        id, user_id, name, description, category,
        servings, total_cost, cost_per_serving, menu_price,
        waste_percentage, target_margin, consumables_buffer,
        is_packaging_preset, is_base_recipe, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15
      )
      ON CONFLICT (id) DO NOTHING`,
      [
        rec.id, rec.user_id, rec.name, rec.description, rec.category,
        rec.servings, rec.total_cost, rec.cost_per_serving, rec.menu_price,
        rec.waste_percentage, rec.target_margin, rec.consumables_buffer,
        rec.is_packaging_preset, rec.is_base_recipe, rec.created_at,
      ]
    );
    if (result.rowCount && result.rowCount > 0) recInserted++;
  }
  console.log(`[migration] recipes: inserted ${recInserted}`);

  // --- Insert recipe_ingredients ---
  let riInserted = 0;
  for (const ri of recipeIngredients.rows) {
    const result = await dest.query(
      `INSERT INTO recipe_ingredients (id, user_id, recipe_id, ingredient_id, quantity, unit)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [ri.id, ri.user_id, ri.recipe_id, ri.ingredient_id, ri.quantity, ri.unit]
    );
    if (result.rowCount && result.rowCount > 0) riInserted++;
  }
  console.log(`[migration] recipe_ingredients: inserted ${riInserted}`);

  // --- Insert recipe_sub_ingredients ---
  let rsiInserted = 0;
  for (const rsi of recipeSubIngredients.rows) {
    const result = await dest.query(
      `INSERT INTO recipe_sub_ingredients (id, user_id, recipe_id, sub_recipe_id, quantity)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [rsi.id, rsi.user_id, rsi.recipe_id, rsi.sub_recipe_id, rsi.quantity]
    );
    if (result.rowCount && result.rowCount > 0) rsiInserted++;
  }
  console.log(`[migration] recipe_sub_ingredients: inserted ${rsiInserted}`);

  // --- Insert category_pricing_settings ---
  let csInserted = 0;
  for (const cs of categorySettings.rows) {
    const result = await dest.query(
      `INSERT INTO category_pricing_settings (id, user_id, category, waste_percentage, target_margin, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [cs.id, cs.user_id, cs.category, cs.waste_percentage, cs.target_margin, cs.updated_at]
    );
    if (result.rowCount && result.rowCount > 0) csInserted++;
  }
  console.log(`[migration] category_pricing_settings: inserted ${csInserted}`);

  // --- Insert waste_logs ---
  let wlInserted = 0;
  for (const wl of wasteLogs.rows) {
    const result = await dest.query(
      `INSERT INTO waste_logs (id, user_id, ingredient_id, quantity, unit, reason, notes, cost_at_time, wasted_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [wl.id, wl.user_id, wl.ingredient_id, wl.quantity, wl.unit, wl.reason, wl.notes, wl.cost_at_time, wl.wasted_at, wl.created_at]
    );
    if (result.rowCount && result.rowCount > 0) wlInserted++;
  }
  console.log(`[migration] waste_logs: inserted ${wlInserted}`);

  console.log(`[migration] All source counts: ${JSON.stringify(srcCounts)}`);
}
