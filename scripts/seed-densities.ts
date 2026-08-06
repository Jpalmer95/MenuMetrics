/**
 * Seed the global density_heuristics table with the curated reference table.
 * Idempotent — existing rows are updated in place (by exact ingredient_name),
 * new rows inserted. Run:
 *
 *   npx tsx scripts/seed-densities.ts
 *
 * (DATABASE_URL must be set, or defaults to local postgres.)
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import { densityHeuristics } from "../shared/schema";
import { CURATED_DENSITIES } from "../shared/density-reference";

const { Pool } = pg;

async function main() {
  const url =
    process.env.DATABASE_URL ||
    "postgresql://localhost:5432/menumetrics";
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  let inserted = 0;
  let updated = 0;

  for (const d of CURATED_DENSITIES) {
    const existing = await db
      .select({ id: densityHeuristics.id })
      .from(densityHeuristics)
      .where(eq(densityHeuristics.ingredientName, d.ingredientName))
      .limit(1);

    if (existing[0]) {
      await db
        .update(densityHeuristics)
        .set({
          gramsPerMilliliter: d.gramsPerMilliliter,
          category: d.category ?? null,
          notes: d.notes ?? null,
          lastUpdated: new Date(),
        })
        .where(eq(densityHeuristics.id, existing[0].id));
      updated++;
    } else {
      await db.insert(densityHeuristics).values({
        ingredientName: d.ingredientName,
        gramsPerMilliliter: d.gramsPerMilliliter,
        category: d.category ?? null,
        notes: d.notes ?? null,
      });
      inserted++;
    }
  }

  console.log(
    `Density heuristics seeded: ${inserted} inserted, ${updated} updated (total ${CURATED_DENSITIES.length})`
  );
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
