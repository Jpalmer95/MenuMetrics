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

### Backend Architecture

**Server Framework**: Express.js with TypeScript, RESTful API.
**Authentication**: Session-based authentication using Replit Auth (OpenID Connect) with multi-user support and data isolation.
**API Structure**: CRUD operations for ingredients and recipes, AI recommendations, user authentication (`/api/auth/user`, `/api/login`, `/api/logout`), export functionality.
**Key Business Logic**:
- **Unit Conversion System**: Handles 13 measurement units across weight, volume, and discrete types, including density-aware conversions and warnings for cross-family conversions without density data.
- **Cost Calculation**: Dynamically calculates per-unit costs from purchase data and applies them to recipe ingredients with unit conversions.
- **Pricing Playground**: Allows calculation of recommended menu pricing based on waste percentage, target margin, and consumables buffer.
- **Yield Percentage**: Accounts for inedible portions of ingredients in cost calculations.

### Data Storage

**Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
**Schema Design**:
- **Users**: Stores user profiles (id, email, names, image), linked via foreign keys with CASCADE DELETE for data isolation.
- **Ingredients**: Stores `userId`, purchase details, `gramsPerMilliliter` for density, `isPackaging` flag, `densitySource`, and `yieldPercentage`.
- **Recipes**: Stores `userId`, metadata (name, category, serving size), pricing (menuPrice, totalCost, profit margin), and pricing playground settings (`wastePercentage`, `targetMargin`, `consumablesBuffer`).
- **Recipe Ingredients Junction**: Links recipes to ingredients with `userId`, quantity, and unit.
- **AI Settings**: Stores `userId` and per-user AI provider selection and API tokens.
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

**Third-Party Libraries**:
- **XLSX**: Excel file parsing and generation.
- **date-fns**: Date formatting.
- **Recharts**: Data visualization.
- **p-retry** & **p-limit**: Concurrency control and retry logic.
- **zod**: Runtime schema validation.
- **react-hook-form**: Form state management.

**Replit-Specific Integrations**: Development-focused plugins like `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, and `@replit/vite-plugin-dev-banner`.