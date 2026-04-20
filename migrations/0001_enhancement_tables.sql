-- MenuMetrics Enhancement Migration
-- Generated: 2026-04-20
-- Adds: employees, purchase_orders, purchase_order_items, price_history, recipe_sales tables
-- Modifies: waste_logs (adds employee tracking)

-- 1. Employees table (business tier multi-user waste logging)
CREATE TABLE IF NOT EXISTS "employees" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "role" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- 2. Add employee tracking to waste_logs
ALTER TABLE "waste_logs" ADD COLUMN IF NOT EXISTS "employee_id" varchar REFERENCES "employees"("id") ON DELETE SET NULL;
ALTER TABLE "waste_logs" ADD COLUMN IF NOT EXISTS "employee_name" text;

-- 3. Purchase orders table
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'draft',
  "vendor" text,
  "notes" text,
  "total_estimated_cost" real DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "submitted_at" timestamp
);

-- 4. Purchase order items table
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" varchar NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
  "ingredient_id" varchar NOT NULL REFERENCES "ingredients"("id") ON DELETE CASCADE,
  "quantity" real NOT NULL,
  "unit" text NOT NULL,
  "estimated_unit_cost" real,
  "estimated_total_cost" real,
  "notes" text
);

-- 5. Price history table
CREATE TABLE IF NOT EXISTS "price_history" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "ingredient_id" varchar NOT NULL REFERENCES "ingredients"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "purchase_cost" real NOT NULL,
  "purchase_quantity" real NOT NULL,
  "purchase_unit" text NOT NULL,
  "cost_per_gram" real,
  "store" text,
  "recorded_at" timestamp NOT NULL DEFAULT now()
);

-- 6. Recipe sales table (for menu engineering)
CREATE TABLE IF NOT EXISTS "recipe_sales" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipe_id" varchar NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "week_start_date" timestamp NOT NULL,
  "units_sold" real NOT NULL DEFAULT 0,
  "revenue" real DEFAULT 0,
  "source" text DEFAULT 'manual'
);

-- 7. Add fixed costs and notification preferences to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monthly_fixed_costs" jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb DEFAULT '{"lowStock":true,"priceIncreases":true,"wasteSpikes":true,"costChanges":true}';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_employees_user_id" ON "employees"("user_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_user_id" ON "purchase_orders"("user_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_status" ON "purchase_orders"("status");
CREATE INDEX IF NOT EXISTS "idx_purchase_order_items_order_id" ON "purchase_order_items"("order_id");
CREATE INDEX IF NOT EXISTS "idx_price_history_ingredient_id" ON "price_history"("ingredient_id");
CREATE INDEX IF NOT EXISTS "idx_price_history_recorded_at" ON "price_history"("recorded_at");
CREATE INDEX IF NOT EXISTS "idx_recipe_sales_recipe_id" ON "recipe_sales"("recipe_id");
CREATE INDEX IF NOT EXISTS "idx_recipe_sales_week_start" ON "recipe_sales"("week_start_date");
