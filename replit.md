# Recipe Cost Analyzer for Coffee Shops & Cafes

A comprehensive web-based restaurant recipe cost analysis application designed specifically for coffee shops and cafes. This application enables food cost management through ingredient tracking, recipe costing, and AI-powered pricing insights.

## Project Overview

**Purpose**: Enable cafe owners and managers to track ingredient costs, create recipes, automatically calculate COGS (Cost of Goods Sold), and leverage AI for menu pricing strategy recommendations.

**Target Users**: Coffee shop owners, cafe managers, and food service professionals who need to manage ingredient inventory and recipe costs.

**Current State**: Fully functional MVP with all core features implemented and tested. Ready for use with optional Excel import and AI integration capabilities.

## Recent Changes

**November 11, 2025**
- Implemented complete schema with TypeScript interfaces for ingredients, recipes, and recipe items
- Built comprehensive frontend with coffee shop themed design (brown/cream color palette)
- Implemented spreadsheet-style ingredients table with inline editing (double-click rows to edit)
- Created Excel import with two-step column mapping interface
- Developed backend API with in-memory storage and automatic COGS recalculation
- Integrated OpenAI and Gemini AI for future pricing recommendations (charges to Replit credits)
- Passed comprehensive end-to-end testing covering all user journeys

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

## Project Architecture

### Tech Stack
- **Frontend**: React with TypeScript, TanStack Query for data fetching
- **Backend**: Express.js with TypeScript
- **Storage**: In-memory storage (MemStorage) with automatic cost recalculation
- **UI Framework**: Shadcn UI components with Tailwind CSS
- **AI Integration**: OpenAI (GPT-5) and Gemini (2.5 Flash) via Replit AI Integrations
- **Routing**: Wouter for client-side navigation
- **Forms**: React Hook Form with Zod validation

### Key Features

#### 1. Ingredients Database
- **Spreadsheet-style table** with sortable columns (name, category, quantity, unit, cost, last updated)
- **Inline editing**: Double-click any row to edit cells directly
- **Search & filter**: Real-time search across ingredient names and categories
- **Add/Edit/Delete**: Full CRUD operations with validation
- **Measurement units**: Support for grams, kg, oz, lbs, cups, tsp, tbsp, mL, L, pints, quarts, gallons

#### 2. Excel Import with Column Mapping
- **Drag & drop** or browse for .xlsx/.xls files
- **Two-step process**:
  1. Upload file and preview first 5 rows
  2. Map Excel columns to required fields (name, category, quantity, unit, cost)
- **Auto-mapping**: Automatically suggests column mappings based on header names
- **Validation**: Ensures all required fields are mapped before import

#### 3. Recipe Builder
- Create recipes with name, description, and servings
- Add ingredients with specific quantities and units
- **Automatic cost calculation**: Total cost and cost per serving calculated in real-time
- **Unit conversion**: Server-side conversion handles different units between recipe and ingredient
- **Live updates**: When ingredient prices change, all affected recipes recalculate automatically

#### 4. Cost Analysis Dashboard
- Overview statistics: total ingredients, total recipes, average cost per recipe
- Visual charts showing cost distribution and trends
- Quick access to recent recipes and high-cost items

#### 5. AI-Powered Insights (Future Enhancement)
- Recipe recommendations based on available ingredients
- Pricing strategy analysis using industry markup standards
- Cost optimization suggestions for ingredient substitution
- Bulk purchasing and seasonal menu recommendations

### Data Models

**Ingredient**
```typescript
{
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  costPerUnit: number
  lastUpdated: Date
}
```

**Recipe**
```typescript
{
  id: string
  name: string
  description: string
  servings: number
  totalCost: number      // Auto-calculated
  costPerServing: number // Auto-calculated
  createdAt: Date
}
```

**RecipeIngredient**
```typescript
{
  id: string
  recipeId: string
  ingredientId: string
  quantity: number
  unit: string
}
```

### API Endpoints

**Ingredients**
- `GET /api/ingredients` - List all ingredients
- `POST /api/ingredients` - Create new ingredient
- `PATCH /api/ingredients/:id` - Update ingredient (triggers recipe recalculation)
- `DELETE /api/ingredients/:id` - Delete ingredient
- `POST /api/ingredients/import` - Import from Excel with column mapping

**Recipes**
- `GET /api/recipes` - List all recipes
- `GET /api/recipes/:id` - Get recipe with ingredients
- `POST /api/recipes` - Create new recipe
- `PATCH /api/recipes/:id` - Update recipe
- `DELETE /api/recipes/:id` - Delete recipe

**Recipe Ingredients**
- `POST /api/recipes/:id/ingredients` - Add ingredient to recipe
- `PATCH /api/recipes/:recipeId/ingredients/:id` - Update ingredient quantity
- `DELETE /api/recipes/:recipeId/ingredients/:id` - Remove ingredient from recipe

### Business Logic

**Automatic Cost Recalculation**
When an ingredient price is updated:
1. Backend identifies all recipes using that ingredient
2. Each affected recipe's cost is recalculated
3. Unit conversions are applied as needed
4. New totalCost and costPerServing are saved
5. Frontend cache is invalidated to show updated values

**Unit Conversion System**
- Maintains conversion table to grams/milliliters as base units
- Converts recipe quantities to ingredient's unit before calculating cost
- Formula: `(convertedQuantity / ingredient.quantity) * ingredient.costPerUnit`

## File Structure

### Important Files

**Schema & Types**
- `shared/schema.ts` - All TypeScript types, Zod schemas, and measurement units

**Frontend Pages**
- `client/src/pages/dashboard.tsx` - Cost analysis dashboard
- `client/src/pages/ingredients.tsx` - Ingredients management page
- `client/src/pages/recipes.tsx` - Recipes list page
- `client/src/pages/recipe-detail.tsx` - Individual recipe with ingredients

**Frontend Components**
- `client/src/components/ingredients-table.tsx` - Spreadsheet-style table with inline editing
- `client/src/components/excel-import-dialog.tsx` - Two-step import with column mapping
- `client/src/components/recipe-builder.tsx` - Recipe creation and ingredient addition
- `client/src/components/recipe-form-dialog.tsx` - Recipe metadata form
- `client/src/components/ingredient-form-dialog.tsx` - Ingredient creation/edit form

**Backend**
- `server/storage.ts` - In-memory storage with IStorage interface
- `server/routes.ts` - All API endpoints with validation
- `server/ai-services.ts` - OpenAI and Gemini integration for future features

**Configuration**
- `client/index.html` - SEO meta tags and title
- `client/src/index.css` - Coffee shop color tokens and theme variables
- `tailwind.config.ts` - Tailwind configuration with design tokens

## User Workflows

### 1. Add Ingredients Manually
1. Navigate to Ingredients page
2. Click "Add Ingredient" button
3. Fill in form: name, category, quantity, unit, cost per unit
4. Submit to create ingredient
5. Ingredient appears in sortable table

### 2. Edit Ingredients Inline (Spreadsheet-style)
1. Double-click any ingredient row in the table
2. Edit cells directly (name, category, quantity, unit, cost)
3. Click check icon to save or X to cancel
4. Changes save immediately and trigger recipe recalculation

### 3. Import from Excel
1. Click "Import Excel" button
2. Drag & drop Excel file or browse to select
3. Preview first 5 rows of data
4. Map Excel columns to required fields using dropdowns
5. Click "Import" to add all ingredients at once

### 4. Create Recipe and Calculate Costs
1. Navigate to Recipes page
2. Click "Create Recipe" button
3. Enter recipe name, description, and servings
4. Click on recipe to open detail view
5. Add ingredients one by one with quantities
6. Total cost and cost per serving calculate automatically
7. View complete ingredient breakdown

### 5. Update Prices and See Recipe Changes
1. Go to Ingredients page
2. Double-click ingredient to edit
3. Change cost per unit
4. Save changes
5. Navigate to any recipe using that ingredient
6. Recipe costs are automatically updated with new price

## Testing Coverage

Comprehensive end-to-end tests verify:
- ✅ Ingredient creation via form
- ✅ Inline editing of ingredients (double-click to edit, save changes)
- ✅ Recipe creation and ingredient addition
- ✅ Automatic cost calculation for recipes
- ✅ Recipe cost recalculation when ingredient prices change
- ✅ Dashboard statistics display
- ✅ Navigation between all pages
- ✅ Success toast notifications

## AI Integration Details

### OpenAI Integration (GPT-5)
- Used for: Creative recipe recommendations based on available ingredients
- Base URL: `AI_INTEGRATIONS_OPENAI_BASE_URL` (Replit-managed)
- API Key: `AI_INTEGRATIONS_OPENAI_API_KEY` (Replit-managed)
- No manual API key setup required - charges to Replit credits

### Gemini Integration (2.5 Flash)
- Used for: Pricing strategy analysis and cost optimization suggestions
- Base URL: `AI_INTEGRATIONS_GEMINI_BASE_URL` (Replit-managed)
- API Key: `AI_INTEGRATIONS_GEMINI_API_KEY` (Replit-managed)
- No manual API key setup required - charges to Replit credits

### AI Functions Available
1. `generateRecipeRecommendations(ingredients, costConstraint)` - Suggests recipes
2. `analyzePricingStrategy(recipeName, totalCost, currentPrice)` - Recommends pricing
3. `generateCostOptimizationSuggestions(recipes)` - Identifies savings opportunities

**Rate Limiting**: AI services include automatic retry logic with exponential backoff (7 retries, 2-128 second delays) to handle rate limits gracefully.

## Design Guidelines

The application follows a coffee shop aesthetic with emphasis on:
- Warm, inviting color palette (browns, creams, chocolates)
- Professional spreadsheet-style data presentation
- Clear visual hierarchy for cost information
- Responsive design for desktop and tablet use
- Accessibility with proper contrast and semantic HTML

### Color Tokens
- `--primary`: Coffee brown (#8B4513) - main brand color
- `--secondary`: Chocolate (#D2691E) - accent color
- `--background`: Cream (#FFF8DC) - warm, welcoming background
- Text hierarchy: Default, secondary (muted), tertiary (more muted)

### Typography
- Headings: Open Sans - clean, professional
- Body: Roboto - readable, modern
- Tabular numbers for cost display

## Development Notes

**Package Management**: All dependencies managed via Replit packager tool (no manual npm install)

**Storage**: Currently using in-memory storage for rapid development. Can be migrated to Postgres database if needed for persistence.

**Environment Variables**: All AI integration secrets are managed automatically by Replit - no manual configuration needed.

**Workflow**: "Start application" workflow runs `npm run dev` which starts both Express backend and Vite frontend on port 5000.

## Future Enhancements (Backlog)

1. **AI Features Activation**: Wire up AI service functions to frontend UI for pricing recommendations
2. **Batch Operations**: Multi-select ingredients for bulk category updates or deletion
3. **Recipe Scaling**: Adjust recipe servings and recalculate quantities automatically
4. **Cost History**: Track ingredient price changes over time with charts
5. **Profit Margin Targets**: Set target margins and get alerts when recipes don't meet them
6. **Menu Planning**: Seasonal menu suggestions based on ingredient availability
7. **Export Functionality**: Export recipes and cost reports to PDF or Excel
8. **Multi-user Support**: User authentication and recipe sharing
9. **Inventory Tracking**: Track actual inventory quantities vs. theoretical usage
10. **Supplier Management**: Track which suppliers provide which ingredients

## Inspiration & References

**Inspired by**:
- ChefTec - Professional recipe costing software
- Recipe Costing Calculator - Spreadsheet-style ingredient management
- Coffee shop menu planning best practices

**Industry Standards**:
- Typical cafe markup: 2.5x - 3.5x on COGS
- Target food cost percentage: 25-35% of menu price
- Inventory turnover goals for fresh ingredients
