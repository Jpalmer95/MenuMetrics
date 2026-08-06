---
name: menumetrics-agent
description: Use when a user wants to set up, populate, or get insights from MenuMetrics (menu costing for restaurants/cafes) via their agent. Import ingredient Excel sheets, fill densities from known values, import recipes, calculate costs, get business/seasonal recommendations.
tags: [menumetrics, restaurant, cafe, menu-costing, cogs, inventory, business]
schema: 1
---

# MenuMetrics Agent

MenuMetrics (https://menumetrics.org) is an open-source menu costing platform
for restaurants, cafes, and small food businesses. It has a token-protected
Agent API (`/api/agent/*`) that lets an agent set the whole thing up: import
ingredients from Excel, fill in densities from known reference values, import
recipes (auto-creating missing ingredients), then pull true costs, margins,
low-stock, waste, and prioritized recommendations.

## When to use

- User wants to import their ingredient spreadsheet or recipe list into MenuMetrics
- User asks to set up/complete densities, costs, or pricing in MenuMetrics
- User asks "what's my food cost / margin / best seller / waste" from MenuMetrics
- User wants seasonal menu ideas, pricing advice, or business recommendations based on their real menu data
- User mentions MenuMetrics.org, menumetrics, or asks their agent to "handle the menu costing"

## API Configuration

- **Base URL**: `https://menumetrics.org` (self-hosted instances differ — ask or infer from context; local dev is `http://localhost:5000`)
- **Auth**: `Authorization: Bearer <token>` or `X-Agent-Token: <token>`
- **Token acquisition**:
  - Hosted: user logs into Settings → Agent API → Create Key (token starts `mm_`, shown once). If the user doesn't have one, walk them through it — they must copy the token; you can't read it back.
  - Self-hosted: `AGENT_BRIDGE_TOKEN` env var or `.agent-bridge-token` file (single tenant).
- **Live spec**: `GET {base}/api/agent/openapi.json`

## API conventions (critical)

- Money is **cents** (integers): `purchase_cost_cents`, `menu_price_cents`, `cost_per_serving_cents`.
- Units are canonical: `grams, kilograms, ounces, pounds, cups, teaspoons, tablespoons, milliliters, liters, pints, quarts, gallons, units`. Abbreviations (`oz`, `g`, `lb`, `tbsp`, `fl oz`, `ea`) are normalized server-side.
- Density = grams per milliliter (g/mL). Water = 1.0, whole milk ≈ 1.03, granulated sugar ≈ 0.85, AP flour ≈ 0.53.
- All responses are JSON. Errors: 401 unauthorized, 503 bridge not configured, 400 invalid data.

## Onboarding playbook (do this in order)

1. **Assess**: `GET /api/agent/me` → read `onboarding` (`needs_ingredients`, `needs_densities`, `needs_recipes`, `needs_pricing`) and `data.recipes_missing_density` / `data.unpriced_recipes`.
2. **Ingredients** — three ways:
   - Excel: `POST /api/agent/ingredients/import` (multipart field `file`, .xlsx). Column names auto-detected: name/ingredient/item, category/type, store/vendor, quantity/qty/amount, unit, cost/price, density, yield.
   - JSON bulk: `POST /api/agent/ingredients/bulk` with `{"ingredients":[{name, category?, purchase_quantity, purchase_unit, purchase_cost_cents, grams_per_milliliter?}]}`.
   - Single: `POST /api/agent/ingredients`.
   - Every row validates independently — `created_count` + `errors[]` come back per row.
3. **Densities** (only for ingredients used in recipes — that's where they matter):
   - `GET /api/agent/density-heuristics/suggest?names=Milk,Flour,...` for deterministic matches against the built-in reference table (180+ entries).
   - For anything unmatched, research known values (USDA FoodData Central, product labels, web) and confirm reasonable ranges — e.g. milks 1.02–1.04, syrups 1.2–1.4, oils 0.91–0.92, ground coffee 0.33–0.40.
   - Apply: `POST /api/agent/ingredients/densities` with `{"densities":[{id OR name, grams_per_milliliter, source?}]}` (source e.g. "USDA", "package label", "heuristic:Whole Milk").
4. **Recipes**:
   - `POST /api/agent/recipes/import` with `{"recipes":[{name, category?, servings?, menu_price_cents?, target_margin_pct?, ingredients:[{name OR ingredient_id, quantity, unit}]}]}`.
   - Ingredient lines by name fuzzy-match existing inventory; **unmatched names are auto-created** with a suggested density.
   - Categories: `food | drink | seasonal_food | seasonal_drink | other`.
5. **Costs & pricing**:
   - `GET /api/agent/recipes/:id` returns `pricing.suggested_price_cents` + `food_cost_pct_at_suggested`.
   - Apply pricing only with owner confirmation: `PATCH /api/agent/recipes/:id/pricing` (`menu_price_cents`, `target_margin_pct`, `waste_percentage`, `consumables_buffer_cents`).
6. **Insights**:
   - `GET /api/agent/summary` — deterministic snapshot (margins, food cost %, inventory value, low stock, waste, density gaps). Zero AI cost; always safe to read.
   - `POST /api/agent/insights` with `{"focus":"all","include_narrative":true}` — prioritized recommendations + optional AI narrative. Foci: `menu | pricing | inventory | waste | seasonal | data_quality | all`.

## Example conversations → actions

- "Import my ingredients from this spreadsheet" → `POST /api/agent/ingredients/import` with the file; report created vs skipped rows.
- "Fill in densities for my ingredients" → `GET /me` → names → `GET /api/agent/density-heuristics/suggest` → research gaps → `POST /api/agent/ingredients/densities`.
- "Add my menu recipes" → `POST /api/agent/recipes/import` (JSON or from parsed text/photo).
- "How is my menu doing?" → `GET /api/agent/summary` (+ `/api/agent/insights`), present the top findings.
- "Suggest seasonal drinks" → `POST /api/agent/insights` focus `seasonal`, or use the UI AI agent (`/api/ai/seasonal-suggestions`).

## Pitfalls

- **Token shown once**: if the user lost their token, they must revoke and create a new key in Settings → Agent API.
- **Units matter**: buying milk by the gallon but using it by the ounce in a recipe needs a density; without one, cross-family conversions return null and the recipe cost will be wrong. Always complete densities before trusting recipe costs.
- **Yield percentage** defaults to 97% (3% waste); for produce with peels use ~65% (bananas). Agents can set `yield_percentage` on import/patch.
- **Never delete or rename** anything via the API — the write surface is create + scoped-patch only by design (owner-only ops stay in the UI).
- **Verify after writes**: GET the created resources back (`/api/agent/ingredients`, `/api/agent/recipes/:id`) before reporting success.
- **Price changes need owner approval**: recommend, don't silently apply.
- **insights narrative** respects the user's AI plan/quota (`narrative_available: false` when out of quota — the deterministic `recommendations` array still works).

## Verification

- `GET /api/agent/health` → `{"ok": true, "version": 3, ...}` means the bridge is reachable.
- After import: confirm `created_count` and re-`GET /api/agent/me` to see `onboarding` flags flip to false.
