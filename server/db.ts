/**
 * Database connection.
 *
 * Originally used @neondatabase/serverless (Replit/Neon hosting), which
 * tunnels Postgres over WebSockets — that crashes against a plain self-hosted
 * Postgres (ws "Unexpected server response: 503" → process exit). Self-hosted
 * deployments (Coolify droplet) use standard node-postgres instead.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export const db = drizzle(pool, { schema });
