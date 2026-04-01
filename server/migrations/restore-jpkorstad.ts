/**
 * One-time data restoration: copies jpkorstad@gmail.com data from NEON database
 * into the current DATABASE_URL (production Replit database).
 *
 * Safe to run multiple times — all inserts use ON CONFLICT DO NOTHING.
 * Skips automatically if data is already present.
 * Only runs if NEON_DATABASE_URL is set AND differs from DATABASE_URL.
 */

import pg from "pg";

const { Pool } = pg;
const JPKORSTAD_USER_ID = "12346030";

export async function restoreJpkorstad(): Promise<void> {
  const neonUrl = process.env.NEON_DATABASE_URL;
  const localUrl = process.env.DATABASE_URL;

  // Skip if NEON URL is missing or is the same as the current DB
  if (!neonUrl || neonUrl === localUrl) {
    console.log("[migration] Skipping restore: NEON_DATABASE_URL not set or same as DATABASE_URL");
    return;
  }

  // Check if jpkorstad already has data in the current (production) database
  const destPool = new Pool({ connectionString: localUrl, ssl: localUrl?.includes("neon.tech") ? { rejectUnauthorized: false } : false });

  try {
    const countResult = await destPool.query(
      "SELECT COUNT(*) as count FROM ingredients WHERE user_id = $1",
      [JPKORSTAD_USER_ID]
    );
    const existingCount = parseInt(countResult.rows[0].count, 10);

    if (existingCount > 0) {
      console.log(`[migration] jpkorstad already has ${existingCount} ingredients in production — skipping restore`);
      return;
    }

    // Also check if the user exists at all in this DB
    const userResult = await destPool.query(
      "SELECT id, email FROM users WHERE id = $1",
      [JPKORSTAD_USER_ID]
    );
    if (userResult.rows.length === 0) {
      console.log("[migration] jpkorstad user not found in production DB — cannot restore without user row");
      return;
    }

    console.log("[migration] jpkorstad has 0 ingredients in production — starting restore from NEON...");

    // Connect to NEON (source of truth)
    const neonPool = new Pool({ connectionString: neonUrl, ssl: { rejectUnauthorized: false } });

    try {
      await runRestore(neonPool, destPool);
    } finally {
      await neonPool.end();
    }

  } finally {
    await destPool.end();
  }
}

async function runRestore(src: pg.Pool, dest: pg.Pool): Promise<void> {
  // Export from NEON
  const ingredients = await src.query(
    "SELECT * FROM ingredients WHERE user_id = $1",
    [JPKORSTAD_USER_ID]
  );
  const recipes = await src.query(
    "SELECT * FROM recipes WHERE user_id = $1",
    [JPKORSTAD_USER_ID]
  );

  const recipeIds = recipes.rows.map((r: any) => r.id);
  let recipeIngredients: any = { rows: [] };
  let recipeSubIngredients: any = { rows: [] };

  if (recipeIds.length > 0) {
    const placeholders = recipeIds.map((_: any, i: number) => `$${i + 1}`).join(",");
    recipeIngredients = await src.query(
      `SELECT * FROM recipe_ingredients WHERE recipe_id IN (${placeholders})`,
      recipeIds
    );
    recipeSubIngredients = await src.query(
      `SELECT * FROM recipe_sub_ingredients WHERE recipe_id IN (${placeholders})`,
      recipeIds
    );
  }

  const categorySettings = await src.query(
    "SELECT * FROM category_pricing_settings WHERE user_id = $1",
    [JPKORSTAD_USER_ID]
  );

  console.log(`[migration] Exporting: ${ingredients.rows.length} ingredients, ${recipes.rows.length} recipes, ${recipeIngredients.rows.length} recipe_ingredients`);

  // Sort ingredients: items without self-referential FK first
  const sortedIngredients = [...ingredients.rows].sort((a: any, b: any) => {
    if (a.addition_base_ingredient_id && !b.addition_base_ingredient_id) return 1;
    if (!a.addition_base_ingredient_id && b.addition_base_ingredient_id) return -1;
    return 0;
  });

  let ingInserted = 0;
  // Insert ingredients (without self-ref FK first)
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

  // Second pass: set addition_base_ingredient_id for self-referencing ingredients
  const withBaseRef = ingredients.rows.filter((i: any) => i.addition_base_ingredient_id);
  for (const ing of withBaseRef) {
    await dest.query(
      "UPDATE ingredients SET addition_base_ingredient_id = $1 WHERE id = $2 AND user_id = $3",
      [ing.addition_base_ingredient_id, ing.id, JPKORSTAD_USER_ID]
    );
  }

  console.log(`[migration] Inserted ${ingInserted} ingredients`);

  // Insert recipes
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
  console.log(`[migration] Inserted ${recInserted} recipes`);

  // Insert recipe_ingredients
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
  console.log(`[migration] Inserted ${riInserted} recipe_ingredients`);

  // Insert recipe_sub_ingredients
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
  console.log(`[migration] Inserted ${rsiInserted} recipe_sub_ingredients`);

  // Insert category pricing settings
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
  console.log(`[migration] Inserted ${csInserted} category_pricing_settings`);

  // Final verification
  const finalIng = await dest.query(
    "SELECT COUNT(*) as count FROM ingredients WHERE user_id = $1",
    [JPKORSTAD_USER_ID]
  );
  const finalRec = await dest.query(
    "SELECT COUNT(*) as count FROM recipes WHERE user_id = $1",
    [JPKORSTAD_USER_ID]
  );
  const finalRi = await dest.query(
    "SELECT COUNT(*) as count FROM recipe_ingredients WHERE user_id = $1",
    [JPKORSTAD_USER_ID]
  );

  console.log(`[migration] DONE — Production now has: ${finalIng.rows[0].count} ingredients, ${finalRec.rows[0].count} recipes, ${finalRi.rows[0].count} recipe_ingredients`);
}
