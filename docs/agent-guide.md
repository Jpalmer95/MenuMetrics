# MenuMetrics Agent Guide

MenuMetrics is **agent-native**: any AI agent (Hermes Agent, Claude Code, Codex,
custom bots) can set up and run a small business's menu costing through a small,
token-protected HTTP API. This guide is written for both humans and agents.

Quick links:

- Live OpenAPI spec: `GET /api/agent/openapi.json` (served by the app itself)
- Companion skill (Hermes Agent): `menumetrics-agent`
- Self-host config: `AGENT_BRIDGE_TOKEN` env var / `.agent-bridge-token` file

---

## 1. Get a token

### Hosted (menumetrics.org) — per-user keys

1. Log in → **Settings → Agent API**
2. Name a key (e.g. "Hermes Agent") → **Create Key**
3. Copy the `mm_…` token — **shown exactly once**

Send it as:

```
Authorization: Bearer mm_xxxxxxxxxxxxxxxx_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

or the `X-Agent-Token` header.

Only the sha256 hash of the secret is stored. Revoking a key from Settings
immediately locks out that token.

### Self-hosted — global token (single tenant)

```bash
export AGENT_BRIDGE_TOKEN="$(openssl rand -hex 24)"        # or write .agent-bridge-token
export AGENT_BRIDGE_USER_EMAIL="owner@example.com"         # optional; defaults to first user
```

---

## 2. Quick start (curl)

```bash
TOKEN="mm_..."

# Who am I + what data is missing (densities, prices)?
curl -H "Authorization: Bearer $TOKEN" https://menumetrics.org/api/agent/me

# Import your ingredient spreadsheet (auto-detects column names)
curl -H "Authorization: Bearer $TOKEN" \
  -F "file=@ingredients.xlsx" \
  https://menumetrics.org/api/agent/ingredients/import

# Fill densities your agent researched (USDA / labels / web)
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"densities":[{"name":"Whole Milk","grams_per_milliliter":1.03,"source":"USDA"},{"name":"AP Flour","grams_per_milliliter":0.53,"source":"USDA"}]}' \
  https://menumetrics.org/api/agent/ingredients/densities

# Import recipes (missing ingredients are created automatically, with density hints)
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"recipes":[{"name":"Vanilla Latte","category":"drink","servings":1,"ingredients":[{"name":"Whole Milk","quantity":8,"unit":"oz"},{"name":"Espresso","quantity":2,"unit":"oz"},{"name":"Vanilla Syrup","quantity":1,"unit":"tbsp"}]}]}' \
  https://menumetrics.org/api/agent/recipes/import

# Full deterministic business snapshot (no LLM cost)
curl -H "Authorization: Bearer $TOKEN" https://menumetrics.org/api/agent/summary

# Actionable recommendations + optional AI narrative
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"focus":"all","include_narrative":true}' \
  https://menumetrics.org/api/agent/insights
```

---

## 3. Endpoint reference

All reads/writes are scoped to the token's user. Money is **cents** (integer);
units are canonical (`grams`, `cups`, `tablespoons`, `units`, …). Agents
creating recipes/ingredients have their rows tagged `[agent]` in descriptions.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/agent/health` | Liveness + auth modes (no token) |
| GET | `/api/agent/openapi.json` | OpenAPI 3.0.3 spec of everything below |
| GET | `/api/agent/me` | Profile + onboarding checklist (missing densities, unpriced recipes, AI usage) |
| GET | `/api/agent/summary` | Deterministic snapshot: margins, food cost %, inventory value, low stock, waste, density gaps |
| GET | `/api/agent/recipes` | All recipes with costs |
| GET | `/api/agent/recipes/:id` | Recipe + ingredients + suggested price |
| POST | `/api/agent/recipes` | Create recipe from `ingredient_id` lines |
| POST | `/api/agent/recipes/import` | Bulk recipe import; fuzzy-matches or auto-creates ingredients |
| PATCH | `/api/agent/recipes/:id/pricing` | Apply `menu_price_cents`, `target_margin_pct`, `waste_percentage` |
| GET | `/api/agent/ingredients` | All ingredients (vendor, pack, cost, density) |
| POST | `/api/agent/ingredients` | Create one ingredient |
| POST | `/api/agent/ingredients/bulk` | Create many (per-row isolation + errors) |
| POST | `/api/agent/ingredients/import` | Excel `.xlsx` upload (multipart `file`) |
| POST | `/api/agent/ingredients/densities` | Bulk-apply researched densities by id or exact name |
| PATCH | `/api/agent/ingredients/:id` | Scoped update: density, purchase cost/qty/unit, price-per-unit, yield, stock, par |
| GET | `/api/agent/stock` | Stock levels + reorder thresholds |
| GET | `/api/agent/waste` | Recent waste events with costs |
| GET | `/api/agent/density-heuristics` | Global density reference table |
| GET | `/api/agent/density-heuristics/suggest?names=…` | Fuzzy density suggestions (no LLM) |
| POST | `/api/agent/insights` | Recommendations by focus: `menu`, `pricing`, `inventory`, `waste`, `seasonal`, `data_quality`, `all`; optional AI narrative |

### Canonical units

`grams, kilograms, ounces, pounds, cups, teaspoons, tablespoons, milliliters,
liters, pints, quarts, gallons, units` — abbreviations are accepted and
normalized (`oz`, `g`, `lb`, `tbsp`, `fl oz`, `ea`, …).

### Ingredient create body (cents)

```json
{
  "name": "Whole Milk",
  "category": "Dairy",
  "store": "HEB",
  "purchase_quantity": 128,
  "purchase_unit": "fl oz",
  "purchase_cost_cents": 499,
  "grams_per_milliliter": 1.03,
  "yield_percentage": 97
}
```

### Recipe import body

```json
{
  "recipes": [
    {
      "name": "Iced Vanilla Latte",
      "category": "drink",
      "servings": 1,
      "menu_price_cents": 550,
      "target_margin_pct": 70,
      "ingredients": [
        { "name": "Whole Milk", "quantity": 8, "unit": "oz" },
        { "name": "Espresso", "quantity": 2, "unit": "oz" },
        { "name": "Vanilla Syrup", "quantity": 1, "unit": "tbsp" }
      ]
    }
  ]
}
```

---

## 4. Agent onboarding playbook (the recommended flow)

1. `GET /api/agent/me` → read `onboarding` flags.
2. If `needs_ingredients`:
   - Ask the owner for their vendor/supplier spreadsheet, or
   - `POST /api/agent/ingredients/import` with their `.xlsx`, or
   - `POST /api/agent/ingredients/bulk` with JSON rows.
3. If `needs_densities`:
   - `GET /api/agent/density-heuristics/suggest?names=…` for deterministic matches,
   - research the rest from known values (USDA FoodData Central, product labels, web),
   - `POST /api/agent/ingredients/densities` to apply.
4. If `needs_recipes`:
   - `POST /api/agent/recipes/import` with the menu; missing ingredients auto-create.
5. If `needs_pricing`:
   - `GET /api/agent/recipes/:id` returns a `pricing.suggested_price_cents`;
     confirm with the owner, then `PATCH /api/agent/recipes/:id/pricing`.
6. `GET /api/agent/summary` → present margins, food cost %, low stock, waste;
   `POST /api/agent/insights` → prioritized recommendations (optionally narrated by AI).

Always confirm price changes with the owner before writing — the platform is
their source of truth; the agent is the assistant.

---

## 5. Security model

- Per-user tokens are hashed (sha256) at rest; the plaintext is shown once.
- Writes are **create + scoped-patch only**: agents can never rename/delete
  ingredients or recipes (that stays owner-only in the UI).
- Global `AGENT_BRIDGE_TOKEN` is for single-tenant self-hosts.
- `Authorization` header or `X-Agent-Token`; HTTPS recommended.
