# MenuMetrics

Recipe cost analysis, inventory tracking, and small business operations software built for restaurants, cafes, and food-service teams who need to know their true margins.

## Features

- **Recipe Management** — Build recipes with precise ingredient linking and yield tracking
- **True Cost Analysis** — Move from base ingredient cost to fully loaded cost per serving
- **Ingredient Database** — Track suppliers, pack sizes, densities, and unit conversions
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
- **AI:** OpenAI / xAI providers for natural-language cost analysis
- **Auth:** Replit Auth integration with custom session handling

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
    settings.tsx             # App configuration
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
  ai-services.ts           # AI provider abstraction
  aiUsageMiddleware.ts     # Usage tracking & limits
  billingRoutes.ts         # Stripe billing endpoints
  stripeClient.ts          # Stripe SDK configuration
  webhookHandlers.ts       # Stripe webhook processing
shared/
  cost-calculator.ts       # Core cost math engine
  density-lookup.ts        # Ingredient density database
  unit-parser.ts           # Natural-language unit parsing
  fuzzy-matcher.ts         # Ingredient name matching
```

## Getting Started

```bash
npm install
npm run dev              # Start dev server
npm run build            # Production build
npm run db:migrate       # Run database migrations
```

## Stripe Setup

Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in your environment. Use the seed scripts in `scripts/` to initialize products and pricing tiers.

## Database Migrations

Migrations live in `migrations/` and `server/migrations/`. Apply with:

```bash
npm run db:migrate
```

## License

MIT
