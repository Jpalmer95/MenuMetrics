# MenuMetrics - Restaurant Recipe Cost Analysis

## Overview

MenuMetrics is a professional recipe cost analysis tool designed for coffee shops and cafes to track ingredient costs, calculate COGS (Cost of Goods Sold), and optimize menu pricing. The application enables users to manage ingredient inventory, build recipes with precise costing, and leverage AI for menu strategy recommendations.

**Core Purpose**: Help restaurant operators understand their true food costs, make data-driven pricing decisions, and maintain profitability through detailed ingredient-to-recipe cost tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**:
- React with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for client-side routing (lightweight alternative to React Router)
- TanStack Query (React Query) for server state management
- Shadcn/ui component library with Radix UI primitives
- Tailwind CSS for styling with custom design tokens

**Design Philosophy**:
- Material Design principles adapted for data-intensive applications
- Cream-colored theme (#FFF8DC background) for professional credibility
- Typography: Open Sans (body/data) + Roboto (headings)
- Focus on spreadsheet-like clarity for quick data scanning
- Mobile-responsive with collapsible sections

**Key UI Components**:
- `IngredientsTable`: Editable table with inline editing capabilities
- `RecipeBuilder`: Split-view interface for recipe composition
- `DashboardStats`: Overview cards with charts (Recharts library)
- Excel import/export dialogs for bulk data operations

### Backend Architecture

**Server Framework**: Express.js with TypeScript
- RESTful API design pattern
- Session-based authentication using Replit Auth (OpenID Connect)
- Multi-user support with complete data isolation by userId
- File upload handling via Multer for Excel imports

**Authentication** (Replit Auth Integration):
- Email/password login with Google, GitHub, Apple, X login options
- Session storage in PostgreSQL using connect-pg-simple
- Authentication middleware on all API routes (`/api/auth/user`, `/api/login`, `/api/logout`)
- Per-user data isolation enforced at both database and storage layer
- CASCADE DELETE rules ensure complete user data cleanup

**API Structure**:
- `/api/auth/user` - Get current authenticated user
- `/api/login` - Initiate Replit Auth login flow
- `/api/logout` - Destroy session and log out
- `/api/ingredients` - CRUD operations for ingredients (user-scoped)
- `/api/ingredients/export` - Export user's ingredients to Excel
- `/api/recipes` - Recipe management endpoints (user-scoped)
- `/api/recipes/:id/ingredients` - Recipe composition (user-scoped)
- `/api/recipes/:id/pricing` - PATCH endpoint for Pricing Playground settings (user-scoped)
- `/api/ai/*` - AI-powered recommendations (user-scoped)
- `/api/settings/ai` - AI provider configuration (user-scoped)

**Key Business Logic**:
- **Unit Conversion System** (`shared/cost-calculator.ts`): Handles weight↔volume conversions using density data
  - Supports 13 measurement units across weight, volume, and discrete ("each") families
  - Density-aware conversions (e.g., 1 cup flour ≠ 1 cup milk in grams)
  - Calculates cost-per-unit for all supported units from purchase data

- **Cost Calculation**: 
  - Purchase data (quantity, unit, cost) → per-unit costs for all measurement systems
  - Recipe ingredients use any unit → system calculates actual cost via conversion
  - Warning system for cross-family conversions without density data

### Data Storage

**Database**: PostgreSQL (via Neon serverless)
- Drizzle ORM for type-safe database operations
- WebSocket-based connection pooling for serverless environment

**Schema Design** (`shared/schema.ts`):

0. **Users Table** (Replit Auth):
   - User profiles: id, email, firstName, lastName, profileImageUrl
   - All user data linked via foreign keys with CASCADE DELETE

1. **Ingredients Table**:
   - **userId**: Foreign key to users (CASCADE DELETE) for data isolation
   - Purchase information: quantity, unit, cost, store
   - Density field (`gramsPerMilliliter`) for accurate volume↔weight conversions
   - Calculated fields: cost per ounce, gram, cup, tablespoon, etc.
   - `isPackaging` flag to separate packaging costs from food costs
   - `densitySource` tracks origin of density data (preset, manual, imported, USDA)

2. **Recipes Table**:
   - **userId**: Foreign key to users (CASCADE DELETE) for data isolation
   - Basic metadata: name, description, category, serving size
   - Pricing: `menuPrice`, `totalCost`, calculated profit margin
   - **Pricing Playground fields**: `wastePercentage` (0-99%), `targetMargin` (1-99%), `consumablesBuffer` (flat cost)
   - Timestamps for tracking

3. **Recipe Ingredients Junction Table**:
   - **userId**: Foreign key to users (CASCADE DELETE) for security
   - Links recipes to ingredients with quantity and unit
   - Enables many-to-many relationships
   - Cost calculated dynamically based on current ingredient prices
   - All operations filtered by userId to prevent cross-user data access

4. **AI Settings Table**:
   - **userId**: Unique foreign key to users (CASCADE DELETE)
   - Per-user AI provider selection (OpenAI, Gemini, Grok, HuggingFace)
   - HuggingFace API token storage (user-specific)

5. **Sessions Table**:
   - PostgreSQL-backed session storage for Replit Auth
   - Automatic session expiry and cleanup

**Migration Strategy**: Drizzle Kit with PostgreSQL dialect, migrations stored in `/migrations`

### External Dependencies

**AI Providers** (via Replit AI Integrations):
- **OpenAI GPT-5**: Recipe recommendations and menu strategy (default provider)
- **Google Gemini**: Alternative AI provider option
- **Grok (via OpenRouter)**: Additional AI model access
- **HuggingFace**: Custom model support with user-provided API token

All AI providers (except HuggingFace) use Replit AI Integrations - no API keys required, usage billed to Replit credits.

**AI Features**:
- **Recipe Idea Generation**: AI suggests recipes based on available ingredients with optional custom prompts (e.g., "Christmas drinks", "vegan options")
- **Menu Pricing Strategy**: AI analyzes menu profitability with optional custom queries (e.g., "focus on high-margin items")
- **Recipe Import with AI**: Parse recipes from text paste or image upload using vision-capable AI models
- **AI Density Estimation**: One-click AI estimation of ingredient densities (g/mL) for accurate cost calculations
  - Analyzes ingredients missing density values using food science knowledge
  - Updates density database with source tracking ("AI-estimated (provider)")
  - Visual sparkle icon (✨) indicates AI-estimated densities in ingredients table
  - Enables cross-family unit conversions (e.g., gallons to ounces) for accurate recipe costing
  - Manual edits override AI estimates and update source to "Manual"
- **Structured Output**: AI returns JSON-formatted recipes for one-click import
- **Provider Selection**: Choose between OpenAI (GPT-5 with vision), Gemini (2.5 Flash with vision), Grok, or HuggingFace
- **Security**: Server-side file validation, size limits (5MB max), type checking, and response sanitization
- Retry logic with exponential backoff for rate limiting

**Third-Party Libraries**:
- **XLSX**: Excel file parsing and generation for bulk import/export
- **date-fns**: Date formatting utilities
- **Recharts**: Data visualization (bar charts, pie charts for dashboard)
- **p-retry** & **p-limit**: Concurrency control and retry logic for AI calls
- **zod**: Runtime schema validation with Drizzle integration
- **react-hook-form**: Form state management with validation

**Replit-Specific Integrations**:
- `@replit/vite-plugin-runtime-error-modal`: Development error overlay
- `@replit/vite-plugin-cartographer`: Code navigation (dev only)
- `@replit/vite-plugin-dev-banner`: Development banner (dev only)

**Configuration Notes**:
- Environment variable `DATABASE_URL` required for database connection
- Environment variable `SESSION_SECRET` required for session encryption (auto-provisioned by Replit Auth)
- AI providers configured via `AI_INTEGRATIONS_*` environment variables (auto-provisioned by Replit)
- Development vs. production builds use different server entry points
- TypeScript strict mode enabled with path aliases for clean imports

## Recent Updates

### November 2025: Pricing Playground Feature
- **Pricing Playground Page** (`/pricing`): New dedicated page for calculating recommended menu pricing
  - Account for hidden costs like waste/shrinkage (spoilage, breakage, calibration, misorders, theft)
  - Set target profit margins (10-95%) with real-time price recommendations
  - Add consumables buffer costs (cups, lids, napkins, etc.)
  - True Cost Calculation: `Base Cost / (1 - Waste%) + Consumables`
  - Suggested Price Calculation: `True Cost / (1 - Target Margin%)`
  - Visual comparison between current menu price and suggested price
  - "Apply Suggested Price" button to update menu price with one click
  - All Recipes Overview table showing pricing status across entire menu
- **Global Settings** (new):
  - Global Waste % slider (0-50%) with "Apply to All Recipes" button for bulk updates
  - Minimum Margin Threshold slider (10-95%, default 80%) flags underperforming items
  - Items below threshold shown with red warning icon and "Below X%" status badge
  - Summary counter shows number of flagged recipes in table header
  - Visual feedback shows whether all recipes meet the margin threshold
- **API Endpoint**: PATCH `/api/recipes/:id/pricing` for saving pricing settings
- **Schema Updates**: Added `wastePercentage`, `targetMargin`, `consumablesBuffer` fields to recipes table
- **Edge Case Handling**: Input validation prevents invalid values (waste capped at 99%, margin 1-99%)

### November 2025: Multi-User Authentication & Team Collaboration
- **Replit Auth Integration**: Added email/password authentication with Google, GitHub, Apple, X login support
- **Complete Data Isolation**: All tables now include userId foreign keys with CASCADE DELETE for security
- **Storage Layer Security**: All storage methods filter by userId to prevent cross-user data access
- **Ingredient Export**: Added `/api/ingredients/export` endpoint for Excel export in import-compatible format
- **Bulk Recipe Import/Export**: Added multiple methods for bulk recipe import with detailed error reporting
  - **Excel/CSV Import**: Upload spreadsheet files with one row per ingredient format
  - **JSON Import**: Paste structured JSON array of recipes for fast, reliable imports (no AI needed)
  - **AI Text Import**: Paste recipes in any format (text, markdown) and AI parses them automatically
  - **AI Provider Support**: All import methods support OpenAI, Gemini, Grok, and HuggingFace
  - **Fuzzy Ingredient Matching**: Intelligently matches ingredient names with variations
    - Handles "whole milk" vs "Milk", "espresso shots" vs "Espresso"
    - Uses Dice coefficient and Levenshtein distance for similarity scoring
    - Auto-matches with ≥80% confidence, rejects below 60%
    - Removes filler words (fresh, organic, whole) for better matching
    - Smart singularization preserves legitimate "s" endings (citrus, glass)
    - Logs fuzzy matches with confidence scores for transparency
  - Import endpoints validate ingredients exist in user inventory with fuzzy matching
  - Export endpoint generates Excel files in import-compatible format for data portability
  - Import dialog shows detailed error messages for missing ingredients and validation failures
  - Supports partial imports (successful recipes are imported even if some fail)
- **Migration Completed**: Existing data migrated to default user account, orphaned records cleaned up
- **Frontend Auth Flow**: Landing page for logged-out users, protected routes, logout button
- **Team Collaboration Ready**: Multiple users can now share a business account with isolated data access
- **Density Column & AI Estimation**: Added visible density column to ingredients table with AI estimation feature
  - New "Density (g/mL)" column displays density values for all ingredients
  - Inline editing allows manual density entry or modification
  - "AI: Add Densities" button automatically estimates missing densities using AI food science knowledge
  - Visual sparkle icon (✨) distinguishes AI-estimated densities from manual entries
  - Hover over sparkle shows density source (e.g., "AI-estimated (OpenAI GPT-5)")
  - Manual edits automatically update source to "Manual" and remove sparkle icon
  - Density values immediately apply to recipe cost calculations for cross-family unit conversions
  - Fixed AI prompt to return exact ingredient names for accurate database matching