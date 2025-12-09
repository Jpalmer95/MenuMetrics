# MenuMetrics - Restaurant Recipe Cost Analysis

## Overview

MenuMetrics is a professional recipe cost analysis tool designed for coffee shops and cafes. Its core purpose is to help restaurant operators track ingredient costs, calculate COGS, optimize menu pricing, and manage inventory to maintain profitability. The application provides detailed ingredient-to-recipe cost tracking and leverages AI for menu strategy recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, Vite, Wouter, TanStack Query, Shadcn/ui (Radix UI), Tailwind CSS.
**Design Philosophy**: Material Design principles, cream-colored theme, Open Sans/Roboto typography, spreadsheet-like clarity, mobile-responsive design.
**Key UI Components**: `IngredientsTable`, `RecipeBuilder`, `DashboardStats`, Excel import/export dialogs.
**Main Pages**:
- **Dashboard** (`/`): Overview with key metrics and quick actions.
- **Ingredients** (`/ingredients`): Full ingredient database with cost tracking.
- **Recipes** (`/recipes`, `/recipes/:id`): Recipe creation and cost analysis.
- **Inventory Count** (`/inventory`): Quick counting interface grouped by storage type.
- **Orders** (`/orders`): Order generator with par value calculations and CSV export.
- **Waste Log** (`/waste-log`): Log and track ingredient waste with cost impact.
- **Waste Analytics** (`/waste-analytics`): Charts showing waste trends, breakdowns by reason, and top wasted items.
- **Pricing** (`/pricing`): Pricing playground for margin analysis.
- **Add-Ins** (`/add-ins`): Pricing configuration for add-in ingredients (whey protein, MCT oil, alternative milks, etc.) with portion cost, upgrade cost calculations, and margin analysis. Supports base ingredient linking for accurate upgrade pricing (e.g., oat milk upgrade shows true cost after subtracting regular milk cost).
- **Densities** (`/densities`): Density reference table for unit conversions.
- **Mise AI** (`/ai-agent`): AI-powered recipe creation and business advice.
- **Settings** (`/settings`): User preferences and AI provider configuration.

### Backend Architecture

**Server Framework**: Express.js with TypeScript, RESTful API.
**Authentication**: Session-based authentication using Replit Auth (OpenID Connect) with multi-user support and data isolation.
**API Structure**: CRUD operations for ingredients and recipes, AI recommendations, user authentication (`/api/auth/user`, `/api/login`, `/api/logout`), export functionality.
**Key Business Logic**:
- **Unit Conversion System**: Handles 13 measurement units across weight, volume, and discrete types, including density-aware conversions and warnings for cross-family conversions without density data.
- **Cost Calculation**: Dynamically calculates per-unit costs from purchase data and applies them to recipe ingredients with unit conversions.
- **Pricing Playground**: Allows calculation of recommended menu pricing based on waste percentage, target margin, and consumables buffer.
- **Yield Percentage**: Accounts for inedible portions of ingredients in cost calculations.
- **Inventory Management**: Par values, current stock tracking, storage type classification (dry/cold/frozen/supplies), count frequency settings (weekly/monthly/as_needed).
- **Order Generation**: Calculates order quantities from par values minus current stock, groups by store, exports to CSV.
- **Waste Tracking**: Logs waste with reason categories (expired/broken/misordered/overproduction/spillage/other), auto-calculates cost impact, analytics with trends and breakdowns.

### Data Storage

**Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
**Schema Design**:
- **Users**: Stores user profiles (id, email, names, image), linked via foreign keys with CASCADE DELETE for data isolation.
- **Ingredients**: Stores `userId`, purchase details, `gramsPerMilliliter` for density, `isPackaging` flag, `isAddition` flag (for add-ins like protein powders), `densitySource`, `yieldPercentage`, inventory fields (`parValue`, `currentStock`, `storageType`, `countFrequency`, `lastCountDate`), and addition pricing fields (`additionPortionSize`, `additionPortionUnit`, `additionMenuPrice`, `additionBaseIngredientId`, `additionBasePortionRatio`) for add-in margin tracking with upgrade cost calculations.
- **Recipes**: Stores `userId`, metadata (name, category, serving size), pricing (menuPrice, totalCost, profit margin), and pricing playground settings (`wastePercentage`, `targetMargin`, `consumablesBuffer`).
- **Recipe Ingredients Junction**: Links recipes to ingredients with `userId`, quantity, and unit.
- **AI Settings**: Stores `userId` and per-user AI provider selection and API tokens.
- **Waste Logs**: Tracks wasted ingredients with `userId`, `ingredientId`, quantity, unit, reason (expired/broken/misordered/overproduction/spillage/other), notes, and calculated cost at time of waste.
- **Inventory Counts**: Records historical inventory counting sessions with `userId`, `storageType`, `itemsCounted`, notes, and timestamp.
- **Sessions**: PostgreSQL-backed session storage.
**Migration Strategy**: Drizzle Kit with PostgreSQL dialect.

## External Dependencies

**AI Providers** (via Replit AI Integrations):
- **OpenAI GPT-5**: Default for recipe recommendations and menu strategy.
- **Google Gemini**: Alternative AI provider.
- **Grok (via OpenRouter)**: Additional AI model access.
- **HuggingFace**: Custom model support with user-provided API token.

**AI Business Assistant** (Four Specialized Tools):
1. **Recipe Creator**: Generates recipes using actual inventory, shows ingredient matching (what you have vs. need), estimates costs and suggests pricing. One-click to add approved recipes.
2. **Seasonal Planner**: Suggests seasonal/holiday menu items based on current inventory, targets specific customer segments, estimates margins.
3. **Pricing Strategist**: Analyzes menu pricing, identifies underpriced/overpriced items, provides competitive positioning recommendations.
4. **Business Advisor**: Location-aware strategy advice, premium product opportunities, revenue growth tactics tailored to business type.

**AI Safety Features**:
- Read-only context: AI receives inventory/recipes/pricing as context but cannot directly modify existing data.
- Creation-only endpoints: AI routes only support POST for creating new items (no DELETE or UPDATE for existing data).
- Explicit user approval: All AI-generated recipes require button click to add.
- Structured JSON validation: All AI outputs validated through Zod schemas before processing.

### Subscription & Billing System

**Pricing Tiers**:
- **Free**: No AI access, basic features only.
- **Trial**: 7-day free trial with 10 AI queries.
- **Starter ($19/mo)**: 50 AI queries/month.
- **Professional ($49/mo)**: 200 AI queries/month.
- **Business ($99/mo)**: 500 AI queries/month.

**Implementation**:
- **Stripe Integration**: Uses Replit's Stripe connector for payment processing.
- **AI Usage Tracking**: `ai_usage` table tracks monthly query usage per user.
- **Usage Enforcement**: `aiUsageMiddleware.ts` enforces limits on all AI endpoints.
- **Billing Routes**: `/api/billing/*` handles checkout, portal sessions, usage tracking.
- **Webhook Handling**: Processes subscription created/updated/deleted and payment failure events.

**UI Components**:
- Settings page Billing tab shows current plan, usage progress, and plan comparison.
- AI Agent page shows usage indicator with remaining queries.
- Upgrade prompts appear when users have no subscription or low remaining queries.

**Third-Party Libraries**:
- **XLSX**: Excel file parsing and generation.
- **date-fns**: Date formatting.
- **Recharts**: Data visualization.
- **p-retry** & **p-limit**: Concurrency control and retry logic.
- **zod**: Runtime schema validation.
- **react-hook-form**: Form state management.

**Replit-Specific Integrations**: Development-focused plugins like `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, and `@replit/vite-plugin-dev-banner`.