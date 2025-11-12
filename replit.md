# Recipe Cost Analyzer for Coffee Shops & Cafes

## Overview
This project is a web-based recipe cost analysis application for coffee shops and cafes. Its primary purpose is to help owners and managers track ingredient costs, create recipes, automatically calculate COGS (Cost of Goods Sold), and utilize AI for menu pricing strategy recommendations. The application is designed to be production-ready, featuring database persistence, recipe categorization, menu pricing with profit margin tracking, and robust cost analysis. It also includes optional Excel import and integrates with AI for advanced insights. The business vision is to empower cafe owners with tools for efficient food cost management and strategic pricing, addressing a key market need in the food service industry.

## Recent Changes (November 2024)
- **Excel Import System**: Production-ready Excel import with template download, flexible column mapping supporting both combined ("64oz", "16 fl oz") and separate ("64" + "oz") quantity/unit formats, and robust unit parsing that handles decimals (1.5lb), multi-word units (fl oz, fluid ounce), and punctuation variations (2 lbs., fl. oz). Returns row-level validation feedback with detailed error messages.
- **Packaging Cost Tracking**: Added `isPackaging` flag to ingredient schema and storage, enabling separation of packaging items (cups, lids, sleeves) from food ingredients for accurate total product costing.
- **Recipe Builder Enhancements**: Updated UI with separate sections for ingredients and packaging, each displaying individual subtotals. Grand total card shows complete product cost (ingredients + packaging) with breakdown.
- **Density-Aware Unit Conversions**: Ingredient schema includes optional `density` field for accurate weight-to-volume conversions with dual-warning UX for cross-family conversions.
- **End-to-End Validation**: Comprehensive testing verified Excel import, recipe creation with ingredients and packaging, subtotal calculations, quantity updates, and real-time cost recalculation.

## User Preferences
**Design Aesthetic**: Coffee shop themed with professional spreadsheet-style data tables
- Primary Color: #8B4513 (Saddle Brown) - warm, coffee-inspired
- Secondary Color: #D2691E (Chocolate) - rich accent
- Background: #FFF8DC (Cornsilk) - cream/beige for warmth
- Fonts: Open Sans (headings), Roboto (body text)

**Data Management Philosophy**:
- Primary method is robust manual data entry with inline table editing
- Excel import is optional/supplementary feature for bulk data
- Emphasis on spreadsheet-like user experience (sortable columns, search, inline editing)

## System Architecture
The application is built with a modern web stack.

### Tech Stack
- **Frontend**: React with TypeScript, TanStack Query, Shadcn UI with Tailwind CSS, Wouter for routing, React Hook Form with Zod validation.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL (Neon-backed) managed with Drizzle ORM.

### UI/UX Decisions
The design follows a coffee shop aesthetic, incorporating warm color palettes (browns, creams), professional spreadsheet-style data tables, and clear visual hierarchies. The application is responsive, targeting desktop and tablet users, with an emphasis on accessibility.

### Core Features
1.  **Ingredients Database**: Spreadsheet-style table with inline editing, search, filter, and full CRUD operations. Supports various measurement units and optional density tracking for accurate weight-to-volume conversions. Ingredients can be marked as packaging items for separate cost tracking.
2.  **Excel Import**: Production-ready Excel import with template download and flexible column mapping that handles both combined quantity/unit formats ("64oz", "16 fl oz") and separate columns ("64" + "fl. oz"). Robust unit parser supports decimals, multi-word units, and punctuation variations. Returns detailed row-level validation feedback with specific error messages for failed imports.
3.  **Recipe Builder**: Allows creation of recipes with names, descriptions, servings, and optional menu prices. Features 9 distinct recipe categories and automatic COGS and profit margin calculations. Separate ingredient and packaging sections with individual subtotals provide complete product costing (food ingredients + packaging materials). Unit conversion handles disparate ingredient and recipe units with density-aware cross-family conversion warnings. Recipe costs automatically recalculate when ingredient prices change.
4.  **Cost Analysis Dashboard**: Provides overview statistics, cost distribution charts, and quick access to critical cost data.
5.  **AI-Powered Insights**: Planned features include AI for recipe recommendations, pricing strategy analysis, and cost optimization suggestions.

### System Design Choices
-   **Automatic Cost Recalculation**: Any update to an ingredient's price automatically triggers a recalculation of all affected recipes' costs and profit margins.
-   **Unit Conversion System**: A robust system handles conversions between various measurement units to ensure accurate cost calculations, using a base unit approach.
-   **Database Persistence**: Utilizes PostgreSQL with Drizzle ORM for type-safe and persistent data storage.

### Data Models
-   **Ingredient**: `id`, `name`, `category`, `quantity` (purchase quantity), `unit` (purchase unit), `costPerUnit` (auto-calculated), `isPackaging` (boolean flag for packaging items), `density` (optional, for weight-volume conversions), `store` (optional), `lastUpdated`.
-   **Recipe**: `id`, `name`, `description`, `category`, `servings`, `menuPrice` (optional), `totalCost` (auto-calculated from ingredients + packaging), `costPerServing` (auto-calculated), `createdAt`.
-   **RecipeIngredient**: `id`, `recipeId`, `ingredientId`, `quantity` (recipe quantity), `unit` (recipe unit, may differ from purchase unit).

### API Endpoints
Standard RESTful API endpoints are provided for CRUD operations on Ingredients, Recipes, and Recipe Ingredients.

## External Dependencies
-   **PostgreSQL (Neon-backed)**: Relational database for persistent storage.
-   **OpenAI (GPT-5)**: Integrated via Replit AI Integrations for creative recipe recommendations.
-   **Google Gemini (2.5 Flash)**: Integrated via Replit AI Integrations for pricing strategy analysis and cost optimization suggestions.