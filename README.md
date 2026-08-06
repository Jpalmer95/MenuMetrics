[![Live Demo](https://img.shields.io/badge/Live%20Demo-menumetrics.org-green?style=flat-square)](https://menumetrics.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=flat-square)](https://orm.drizzle.team)

# MenuMetrics

Recipe cost analysis, inventory tracking, and small business operations software built for restaurants, cafes, and food-service teams who need to know their true margins.

**Agent-native since 2026:** MenuMetrics ships with a token-protected Agent API and companion skills, so a business can hand its own AI agent (Hermes Agent, Claude, custom bots) a spreadsheet or a menu photo and get fully costed recipes, density-complete ingredients, and prioritized business recommendations — no manual data entry.

## Features

- **Recipe Management** — Build recipes with precise ingredient linking and yield tracking
- **True Cost Analysis** — Move from base ingredient cost to fully loaded cost per serving
- **Ingredient Database** — Track suppliers, pack sizes, densities, and unit conversions
- **Agent API** — Token-protected REST API (`/api/agent/*`) + OpenAPI spec for any agent; per-user keys from Settings → Agent API
- **Agent Onboarding** — Agents import Excel ingredient lists, bulk-apply densities from known reference values (USDA/labels/web), import full recipes (missing ingredients auto-created), and get deterministic + AI-narrated business insights
- **Curated Density Reference** — 180+ coffee-shop/restaurant densities seeded into the global heuristics table (`scripts/seed-densities.ts`)
- **Inventory Counts** — Periodic stock takes with variance reporting
- **Purchase Orders** — Generate and track orders against vendors
- **Waste Analytics** — Log waste by reason and track trends over time
- **Break-Even Calculator** — Determine pricing thresholds for profitability
- **Pricing Playground** — Model menu price changes and see margin impact instantly
- **Admin-Managed Pricing** — Role-based pricing tiers with Stripe billing integration
- **AI Agent** — Ask natural-language questions about costs, inventory, and margins
- **Dashboard & Charts** — Visualize food cost percentage, waste trends, and top movers
- **Excel Import** — Bulk-import recipes and ingredients from spreadsheets
- **Unit Conversions** — Automatic conversion between weight, volume, and count units
- **Employee Management** — Role-based access for kitchen staff, managers, and owners
- **Theme Toggle** — Light / dark mode support

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **Backend:** Express, Drizzle ORM, PostgreSQL
- **Payments:** Stripe (subscriptions & managed pricing tiers)
- **AI:** OpenAI / Gemini / OpenRouter / Ollama / HuggingFace — standard env vars (see below)
- **Auth:** Local email/password with session handling

## AI Provider Configuration

Modern deployments use standard environment variables (legacy Replit AI
Integrations variables still work as fallbacks):

```bash
# OpenAI
OPENAI_API_KEY=sk-...            # optional: OPENAI_BASE_URL, AI_OPENAI_MODEL
# Google Gemini
GEMINI_API_KEY=...               # optional: GEMINI_BASE_URL, AI_GEMINI_MODEL
# OpenRouter (Grok, Claude, Llama, DeepSeek, Mistral…)
OPENROUTER_API_KEY=sk-or-...     # optional: AI_OPENROUTER_MODEL
```

Per-user provider choice (including Ollama on localhost and custom HuggingFace
tokens) is configurable in Settings → AI Provider.

## Agent API Quickstart

```bash
# 1. Settings → Agent API → Create Key (or self-host: AGENT_BRIDGE_TOKEN env)
TOKEN="mm_..."

# 2. Import ingredients from Excel
curl -H "Authorization: Bearer $TOKEN" -F "file=@ingredients.xlsx" \
  https://menumetrics.org/api/agent/ingredients/import

# 3. Apply researched densities
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"densities":[{"name":"Whole Milk","grams_per_milliliter":1.03,"source":"USDA"}]}' \
  https://menumetrics.org/api/agent/ingredients/densities

# 4. Import recipes
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"recipes":[{"name":"Vanilla Latte","category":"drink","ingredients":[{"name":"Whole Milk","quantity":8,"unit":"oz"}]}]}' \
  https://menumetrics.org/api/agent/recipes/import

# 5. Insights
curl -H "Authorization: Bearer $TOKEN" https://menumetrics.org/api/agent/summary
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"focus":"all"}' https://menumetrics.org/api/agent/insights
```

Full reference: [`docs/agent-guide.md`](docs/agent-guide.md) and the live
`GET /api/agent/openapi.json`. Hermes Agent users get the `menumetrics-agent`
companion skill.

## Project Structure

```
client/src/
  pages/
    recipes.tsx              # Recipe library and builder
    recipe-detail.tsx        # Single recipe cost breakdown
    ingredients.tsx          # Ingredient database
    inventory-count.tsx      # Stock take interface
    purchase-orders.tsx      # PO creation and tracking
    waste-log.tsx            # Waste entry and logging
    waste-analytics.tsx      # Waste trend dashboards
    break-even.tsx           # Break-even calculator
    pricing-playground.tsx   # Price modeling tool
    dashboard.tsx            # Main operations dashboard
    ai-agent.tsx             # Natural-language AI assistant
    employees.tsx            # Team management
    settings.tsx             # App configuration (incl. Agent API keys)
  components/
    recipe-builder.tsx       # Visual recipe construction
    ingredients-table.tsx    # Sortable/filterable ingredient grid
    dashboard-charts.tsx     # KPI visualizations
    dashboard-stats.tsx      # Summary stat cards
    onboarding-welcome.tsx   # First-time user flow
  lib/
    unit-conversions.ts      # Standardized unit math
    authUtils.ts             # Session and role helpers
server/
  agentBridge.ts            # Agent API v3 (per-user keys, imports, insights, OpenAPI)
  ai-providers.ts           # Modern AI provider abstraction (env-configurable)
  aiUsageMiddleware.ts      # Usage tracking & limits
  billingRoutes.ts          # Stripe billing endpoints
  stripeClient.ts           # Stripe SDK configuration
  webhookHandlers.ts        # Stripe webhook processing
shared/
  cost-calculator.ts        # Core cost math engine
  density-lookup.ts         # Ingredient density matching
  density-reference.ts      # Curated density table (180+ entries, seeds the DB)
  unit-parser.ts            # Natural-language unit parsing
  fuzzy-matcher.ts          # Ingredient name matching
```

## Getting Started

```bash
npm install
npm run dev              # Start dev server
npm run build            # Production build
npm run db:migrate       # Run database migrations
npx tsx scripts/seed-densities.ts   # Seed the global density reference table
```

## Stripe Setup

Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in your environment. Use the seed scripts in `scripts/` to initialize products and pricing tiers.

## Database Migrations

Migrations live in `migrations/` and `server/migrations/`. Apply with:

```bash
npm run db:migrate
```

## License

Apache-2.0
