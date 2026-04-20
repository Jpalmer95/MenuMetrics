# MenuMetrics Enhancement Implementation Plan

> **Goal:** Transform MenuMetrics from a strong cost-calculator into a full small-business kitchen operations platform — automated ordering, employee waste tracking, price history, recipe scaling, smart alerts, and more.

> **Architecture:** Extend the existing Drizzle ORM + Express + React stack. New tables for purchase_orders, price_history, employees, recipe_sales. New pages/components following existing patterns (shadcn/ui, react-query, wouter).

> **Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), Express, React, shadcn/ui, react-query, wouter, recharts, date-fns, zod.

---

## PHASE 1 — Schema & Data Layer (Foundation)

### Task 1.1: Add `employees` table to schema

**Objective:** Enable business-tier accounts to track which employee logged waste entries.

**File:** `shared/schema.ts`

Add after the `wasteLogs` table definition (~line 463):

```typescript
// Employees table - for business tier multi-user waste logging
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"), // "cook", "barista", "manager", etc.
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "Employee name is required").max(100),
  role: z.string().max(50).optional(),
  isActive: z.boolean().optional().default(true),
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;
```

Add `employeeId` field to `wasteLogs` table:

```typescript
// In wasteLogs table, add after notes field:
employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "set null" }),
employeeName: text("employee_name"), // Denormalized for display even if employee deleted
```

Update `insertWasteLogSchema` to include optional employee fields:

```typescript
// Add to .extend():
employeeId: z.string().nullable().optional(),
employeeName: z.string().optional(),
```

---

### Task 1.2: Add `purchase_orders` table to schema

**Objective:** Persist order carts so users can build, review, and submit orders.

**File:** `shared/schema.ts`

```typescript
// Purchase orders - saved order carts
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("draft"), // "draft", "submitted", "received", "canceled"
  vendor: text("vendor"), // store name or vendor key
  notes: text("notes"),
  totalEstimatedCost: real("total_estimated_cost").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  ingredientId: varchar("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  estimatedUnitCost: real("estimated_unit_cost"),
  estimatedTotalCost: real("estimated_total_cost"),
  notes: text("notes"),
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["draft", "submitted", "received", "canceled"]).optional().default("draft"),
  vendor: z.string().optional(),
  notes: z.string().optional(),
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
}).extend({
  quantity: z.number().positive("Quantity must be positive"),
  estimatedUnitCost: z.number().nonnegative().optional(),
  estimatedTotalCost: z.number().nonnegative().optional(),
});

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: Array<PurchaseOrderItem & { ingredient: Ingredient }>;
}
```

---

### Task 1.3: Add `price_history` table to schema

**Objective:** Track ingredient cost changes over time for trend analysis.

**File:** `shared/schema.ts`

```typescript
// Price history - tracks ingredient cost changes
export const priceHistory = pgTable("price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ingredientId: varchar("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purchaseCost: real("purchase_cost").notNull(),
  purchaseQuantity: real("purchase_quantity").notNull(),
  purchaseUnit: text("purchase_unit").notNull(),
  costPerGram: real("cost_per_gram"),
  store: text("store"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
  recordedAt: true,
});

export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;
export type PriceHistory = typeof priceHistory.$inferSelect;
```

---

### Task 1.4: Add `recipe_sales` table to schema

**Objective:** Track estimated/actual sales volume per recipe for menu engineering matrix.

**File:** `shared/schema.ts`

```typescript
// Recipe sales - weekly sales estimates for menu engineering
export const recipeSales = pgTable("recipe_sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStartDate: timestamp("week_start_date").notNull(),
  unitsSold: real("units_sold").notNull().default(0),
  revenue: real("revenue").default(0),
  source: text("source").default("manual"), // "manual", "import", "pos_webhook"
});

export const insertRecipeSalesSchema = createInsertSchema(recipeSales).omit({
  id: true,
}).extend({
  unitsSold: z.number().nonnegative().default(0),
  revenue: z.number().nonnegative().optional(),
  source: z.enum(["manual", "import", "pos_webhook"]).optional().default("manual"),
});

export type InsertRecipeSales = z.infer<typeof insertRecipeSalesSchema>;
export type RecipeSales = typeof recipeSales.$inferSelect;
```

---

### Task 1.5: Add `settings` fields for notifications and business config

**Objective:** Store user preferences for alerts and business tier settings.

**File:** `shared/schema.ts`

Add to `users` table:

```typescript
// Add to users table after role field:
employeeManagementEnabled: boolean("employee_management_enabled").default(false),
notificationPreferences: jsonb("notification_preferences").default({
  lowStock: true,
  priceIncreases: true,
  wasteSpikes: true,
  costChanges: true,
}),
monthlyFixedCosts: jsonb("monthly_fixed_costs"), // { rent, labor, utilities, other } for break-even
```

---

## PHASE 2 — Storage Layer (Database Methods)

### Task 2.1: Add employee CRUD methods to storage

**File:** `server/storage.ts`

Add to `IStorage` interface:

```typescript
// Employees
getEmployees(userId: string): Promise<Employee[]>;
createEmployee(employee: InsertEmployee, userId: string): Promise<Employee>;
updateEmployee(id: string, employee: Partial<InsertEmployee>, userId: string): Promise<Employee | undefined>;
deleteEmployee(id: string, userId: string): Promise<boolean>;
```

Implement in storage class (follow existing pattern with `db.select().from(table)` etc).

---

### Task 2.2: Add purchase order CRUD methods to storage

**File:** `server/storage.ts`

```typescript
// Purchase Orders
getPurchaseOrders(userId: string): Promise<PurchaseOrder[]>;
getPurchaseOrderWithItems(orderId: string, userId: string): Promise<PurchaseOrderWithItems | undefined>;
createPurchaseOrder(order: InsertPurchaseOrder, userId: string): Promise<PurchaseOrder>;
updatePurchaseOrderStatus(orderId: string, status: string, userId: string): Promise<PurchaseOrder | undefined>;
deletePurchaseOrder(orderId: string, userId: string): Promise<boolean>;
addPurchaseOrderItem(orderId: string, item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
removePurchaseOrderItem(itemId: string): Promise<boolean>;
```

---

### Task 2.3: Add price history methods to storage

**File:** `server/storage.ts`

```typescript
// Price History
getPriceHistory(ingredientId: string): Promise<PriceHistory[]>;
recordPriceSnapshot(ingredient: Ingredient): Promise<PriceHistory>;
getIngredientPriceTrends(userId: string): Promise<Array<{ ingredientId: string; name: string; history: PriceHistory[] }>>;
```

---

### Task 2.4: Add recipe sales methods to storage

**File:** `server/storage.ts`

```typescript
// Recipe Sales
getRecipeSales(recipeId: string, weeks?: number): Promise<RecipeSales[]>;
upsertWeeklySales(data: InsertRecipeSales): Promise<RecipeSales>;
getMenuEngineeringData(userId: string): Promise<Array<{
  recipe: Recipe;
  avgWeeklyUnits: number;
  totalRevenue: number;
  contributionMargin: number;
  classification: "star" | "puzzle" | "plowhorse" | "dog";
}>>;
```

---

## PHASE 3 — API Routes

### Task 3.1: Add employee management routes

**File:** `server/routes.ts`

```
GET    /api/employees          - list employees
POST   /api/employees          - create employee
PATCH  /api/employees/:id      - update employee
DELETE /api/employees/:id      - delete employee
```

Gate employee management behind business tier check:

```typescript
function isBusinessTier(user: User): boolean {
  return user.subscriptionTier === "business" && user.subscriptionStatus === "active";
}
```

---

### Task 3.2: Add purchase order routes

**File:** `server/routes.ts`

```
GET    /api/purchase-orders                    - list orders
GET    /api/purchase-orders/:id                - order with items
POST   /api/purchase-orders                    - create order
PATCH  /api/purchase-orders/:id/status         - update status
DELETE /api/purchase-orders/:id                - delete order
POST   /api/purchase-orders/:id/items          - add item
DELETE /api/purchase-orders/:id/items/:itemId   - remove item
POST   /api/purchase-orders/generate-from-low-stock  - auto-generate from par levels
```

The `generate-from-low-stock` endpoint:
1. Query ingredients where `currentStock < parValue`
2. Calculate `orderQuantity = parValue - currentStock`
3. Create a draft purchase order with those items
4. Return the created order

---

### Task 3.3: Add price history routes

**File:** `server/routes.ts`

```
GET    /api/ingredients/:id/price-history      - history for one ingredient
GET    /api/price-trends                       - all ingredients trends for user
```

Auto-record: In `PATCH /api/ingredients/:id` route, after updating, call `recordPriceSnapshot()` to archive old price.

---

### Task 3.4: Add recipe sales routes

**File:** `server/routes.ts`

```
GET    /api/recipes/:id/sales                  - sales data for recipe
POST   /api/recipes/:id/sales                  - upsert weekly sales
GET    /api/menu-engineering                   - full matrix data
POST   /api/recipes/:id/estimate-weekly-sales  - simple manual input
```

---

### Task 3.5: Add smart notification computation endpoint

**File:** `server/routes.ts`

```
GET    /api/notifications                      - compute and return active alerts
```

Logic:
- Low stock: `ingredients WHERE currentStock < parValue`
- Price increases: compare latest `priceHistory` entries
- Waste spike: compare current week waste total to 4-week average
- Cost changes: recipes whose costPerServing changed >10% due to ingredient updates

---

### Task 3.6: Add break-even analysis endpoint

**File:** `server/routes.ts`

```
GET    /api/break-even                         - compute break-even per recipe
POST   /api/settings/fixed-costs               - update monthly fixed costs
```

Break-even formula:
```
monthlyFixedCosts = user.monthlyFixedCosts
contributionMargin = menuPrice - costPerServing
breakEvenUnits = monthlyFixedCosts.total / contributionMargin (per recipe)
```

---

## PHASE 4 — Frontend Pages & Components

### Task 4.1: Enhance waste log form with employee picker

**File:** `client/src/pages/waste-log.tsx`

Changes:
- Add employee dropdown to waste form (conditionally shown for business tier)
- Query `/api/employees` when user is business tier
- Show employee name column in waste log table
- Add "Employee" filter to waste log

---

### Task 4.2: Create Employees management page

**Files:**
- Create: `client/src/pages/employees.tsx`
- Modify: `client/src/components/app-sidebar.tsx` (add nav item under Operations, business tier only)
- Modify: `client/src/App.tsx` (add route)

Page features:
- List employees with name, role, active status
- Add/edit/delete employee form
- Only accessible for business tier users

---

### Task 4.3: Create Purchase Orders page

**Files:**
- Create: `client/src/pages/purchase-orders.tsx`
- Modify: `client/src/components/app-sidebar.tsx` (rename "Orders" to "Ordering", add sub-navigation or replace)
- Modify: `client/src/App.tsx` (add route or update existing orders route)

Page features:
- List of purchase orders with status badges (draft/submitted/received/canceled)
- View order details with line items
- "Generate from Low Stock" button
- Add/remove items from draft orders
- Mark order as submitted/received
- Estimated cost totals

---

### Task 4.4: Enhance Inventory Count with "Add to Order" and "Log Waste"

**File:** `client/src/pages/inventory-count.tsx`

Changes:
- After saving count, if any item is below par, show "Add Low Stock to Order" button
- On each row, if actual < expected (based on last count), show "Log as Waste" quick-action
- "Log as Waste" pre-fills waste form with delta quantity

---

### Task 4.5: Create Recipe Scaling component

**File:** `client/src/pages/recipe-detail.tsx`

Add a "Scale Recipe" widget:
- Input: target servings (or multiplier like 2x, 5x, 10x)
- Recalculate all ingredient quantities dynamically
- Show scaled quantities without saving (prep calculator)
- "Print Prep Sheet" button (window.print with print CSS)

---

### Task 4.6: Enhance Orders page with persistent cart

**File:** `client/src/pages/orders.tsx`

Changes:
- Add "Save as Purchase Order" button after vendor selection
- Integrates with new purchase orders system
- Show link to saved orders

---

### Task 4.7: Enhance Waste Analytics page

**File:** `client/src/pages/waste-analytics.tsx`

Changes:
- Add time period selector: 7 days, 30 days, 90 days, 12 months
- Add "Export CSV" button
- Add per-employee breakdown chart (business tier)
- Add "Top Waste Items" ranked list with cost
- Add waste cost as % of total ingredient value metric

---

### Task 4.8: Create Smart Notifications component

**Files:**
- Create: `client/src/components/notification-bell.tsx`
- Modify: `client/src/App.tsx` (add to header)

Features:
- Bell icon in header with badge count
- Dropdown showing active alerts:
  - Low stock items (links to inventory)
  - Price increases (links to ingredient)
  - Waste spikes (links to waste analytics)
  - Cost changes (links to recipe)
- Dismiss individual alerts
- Query `/api/notifications` on load

---

### Task 4.9: Create Price History view for ingredients

**File:** `client/src/pages/ingredients.tsx`

Changes:
- Add expandable row or modal showing price history chart for each ingredient
- Small sparkline chart in ingredient table (optional, could be modal only)
- Modal with recharts line chart showing cost changes over time

---

### Task 4.10: Enhance Dashboard with Menu Engineering Matrix

**File:** `client/src/components/dashboard-charts.tsx`

Changes:
- Implement the `menu_engineering_matrix` chart type as a scatter plot quadrant:
  - X-axis: Popularity (avg weekly units sold)
  - Y-axis: Contribution margin ($)
  - Quadrant lines at median values
  - Color-coded quadrants: Star (green), Puzzle (blue), Plowhorse (amber), Dog (red)
- Requires recipe_sales data; show "Enter sales data to unlock" message if empty

---

### Task 4.11: Create Break-Even Analysis page/section

**Files:**
- Create: `client/src/pages/break-even.tsx`
- Modify: `client/src/components/app-sidebar.tsx` (add under Tools)
- Modify: `client/src/App.tsx` (add route)

Features:
- Input form for monthly fixed costs (rent, labor, utilities, other)
- Table showing each recipe's break-even units per month
- Visual indicator of which items are already above break-even
- "What-if" calculator: adjust menu price, see new break-even

---

### Task 4.12: Add Recipe Cost Alert badges

**File:** `client/src/pages/recipes.tsx`

Changes:
- Show badge on recipe row if cost changed >10% since last snapshot
- Badge says "Cost Up" or "Cost Down" with percentage
- Tooltip explaining which ingredient(s) caused the change

---

## PHASE 5 — Integration & Polish

### Task 5.1: Wire price history recording into ingredient updates

**File:** `server/routes.ts`

In `PATCH /api/ingredients/:id` handler, after successful update:
```typescript
// Record price history if cost changed
if (updated.purchaseCost !== existing.purchaseCost || 
    updated.purchaseQuantity !== existing.purchaseQuantity) {
  await storage.recordPriceSnapshot(existing); // record OLD price before update
}
```

---

### Task 5.2: Add print-friendly CSS for recipe cards and inventory sheets

**File:** `client/src/index.css`

```css
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .sidebar, header, footer { display: none !important; }
  main { padding: 0 !important; }
  .recipe-card { page-break-inside: avoid; border: 1px solid #ccc; }
}
```

---

### Task 5.3: Add notification bell to header

**File:** `client/src/App.tsx`

In the header bar, add `<NotificationBell />` next to the theme toggle.

---

### Task 5.4: Update sidebar navigation

**File:** `client/src/components/app-sidebar.tsx`

Updated nav structure:
```
Core:
  - Dashboard
  - Ingredients
  - Recipes

Operations:
  - Inventory Count
  - Purchase Orders (renamed from Orders)
  - Waste Log
  - Employees (business tier only)

Tools:
  - Pricing
  - Add-Ins
  - Densities
  - Break-Even

AI:
  - Mise AI
```

---

### Task 5.5: Run database migration

Create migration file for all new tables:

```bash
npx drizzle-kit generate
```

Verify migration runs cleanly.

---

### Task 5.6: Integration testing checklist

Verify each feature end-to-end:
- [ ] Create employee, log waste as that employee, see name in waste log
- [ ] Generate purchase order from low stock, add/remove items, mark submitted
- [ ] Update ingredient price, verify price history recorded
- [ ] Enter recipe sales data, verify menu engineering matrix populates
- [ ] View break-even analysis with fixed costs entered
- [ ] See notification bell with low stock alert after inventory count
- [ ] Scale recipe to 5x, verify quantities update
- [ ] Export waste analytics CSV
- [ ] Print recipe card (verify print CSS)

---

## Summary Table

| Phase | Tasks | Scope | Status |
|-------|-------|-------|--------|
| 1. Schema | 1.1–1.5 | 4 new tables, 2 modified tables | DONE |
| 2. Storage | 2.1–2.4 | ~20 new DB methods | DONE |
| 3. API Routes | 3.1–3.6 | ~20 new endpoints | DONE |
| 4. Frontend | 4.1–4.12 | 4 new pages, 8 modified pages/components | PARTIAL (4.2, 4.3, 4.8, 4.11 done; 4.1, 4.4, 4.5, 4.6, 4.7, 4.9, 4.10, 4.12 remaining) |
| 5. Polish | 5.1–5.6 | Integration, migration, testing | PARTIAL (5.1, 5.2 done; 5.3–5.6 remaining) |
| **Total** | **30 tasks** | **Full kitchen ops platform** | ~60% complete |

## Completed in this session
- Task 1.1: employees table with insertEmployeeSchema
- Task 1.2: purchase_orders + purchase_order_items tables
- Task 1.3: price_history table
- Task 1.4: recipe_sales table
- Task 1.5: (partial - schema fields added, users table columns deferred)
- Task 2.1: Employee CRUD in storage
- Task 2.2: Purchase order CRUD in storage
- Task 2.3: Price history methods in storage
- Task 2.4: Recipe sales + menu engineering data in storage
- Task 3.1: Employee management routes (business tier gated)
- Task 3.2: Purchase order routes including generate-from-low-stock
- Task 3.3: Price history route
- Task 3.4: Recipe sales + menu engineering routes
- Task 3.5: Smart notifications route
- Task 3.6: Break-even analysis route
- Task 4.2: Employees management page
- Task 4.3: Purchase Orders page with auto-generate
- Task 4.8: Notification Bell component
- Task 4.11: Break-Even Analysis page
- Task 5.1: Auto price history recording on ingredient updates
- Task 5.2: Print CSS for recipe cards and inventory sheets
- Sidebar updated with new navigation items

## Remaining for next session
- Task 4.1: Enhance waste log form with employee picker
- Task 4.4: Enhance inventory count with "Add to Order" and "Log Waste"
- Task 4.5: Recipe scaling component
- Task 4.6: Enhance Orders page with save-as-purchase-order
- Task 4.7: Enhance Waste Analytics page (time periods, export, per-employee)
- Task 4.9: Price history view for ingredients
- Task 4.10: Menu engineering matrix chart on dashboard
- Task 4.12: Recipe cost alert badges
- Task 5.3: (done - notification bell added)
- Task 5.4: (done - sidebar updated)
- Task 5.5: Database migration (run drizzle-kit generate)
- Task 5.6: Integration testing checklist
