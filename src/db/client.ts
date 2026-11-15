import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

/**
 * Two database modes, same Postgres dialect in both:
 *
 * - DATABASE_URL set: a real Postgres (Supabase, Neon, ...). Use this in production.
 * - DATABASE_URL unset: PGlite, an embedded Postgres stored in ./.data.
 *   Zero setup for local development. It is single-process, so it is not
 *   suitable for serverless hosting.
 *
 * Migrations in ./drizzle are applied on first use in both modes.
 */

type Db = import("drizzle-orm/pglite").PgliteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __sanityDb?: Promise<Db> };

async function create(): Promise<Db> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  if (process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const postgres = (await import("postgres")).default;
    const sql = postgres(process.env.DATABASE_URL, { max: 5, prepare: false });
    const db = drizzle(sql, { schema });
    await migrate(db, { migrationsFolder });
    // Both drivers expose the same query builder; the cast keeps one type for callers.
    await syncModels(db as unknown as Db);
    return db as unknown as Db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (dataDir !== "memory") mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = dataDir === "memory" ? new PGlite() : new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });

  // A fresh local database gets demo content so the site is not empty.
  const { seedIfEmpty } = await import("./seed");
  await seedIfEmpty(db);
  await syncModels(db);
  return db;
}

/** Adds any model from the registry that the database does not know yet. */
async function syncModels(db: Db) {
  const { modelRegistry } = await import("@/engine/registry");
  await db.insert(schema.models).values(modelRegistry).onConflictDoNothing();
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__sanityDb) {
    globalForDb.__sanityDb = create().catch((err) => {
      // Do not cache a failed start: the next request should try again.
      globalForDb.__sanityDb = undefined;
      throw err;
    });
  }
  return globalForDb.__sanityDb;
}

export type { Db };
export { schema };
