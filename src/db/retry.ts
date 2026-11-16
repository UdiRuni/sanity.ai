/**
 * Postgres error codes that mean "another process was creating the same
 * objects at the same moment": unique_violation (raised on the system
 * catalogs), duplicate_table, duplicate_object, duplicate_schema,
 * serialization_failure and deadlock_detected.
 */
const MIGRATION_RACE_CODES = new Set(["23505", "42P07", "42710", "42P06", "40001", "40P01"]);

/** Finds a Postgres error code on an error or anywhere in its cause chain. */
export function pgErrorCode(err: unknown): string | undefined {
  for (let e = err, depth = 0; e && typeof e === "object" && depth < 6; depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * On a serverless host several instances can start at once on an empty
 * database, and each one tries to apply the same migrations. Every migration
 * run is one transaction, so the instance that loses the race is rolled back
 * completely and can simply run again: by then the winner has committed and
 * the second run finds nothing left to do. Any other error is not retried.
 */
export async function withMigrationRetry<T>(
  run: () => Promise<T>,
  { attempts = 5, baseDelayMs = 250 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      const code = pgErrorCode(err);
      if (attempt >= attempts || !code || !MIGRATION_RACE_CODES.has(code)) throw err;
      // Grow the wait and add jitter so the losers do not collide again.
      const delay = baseDelayMs * attempt + Math.floor(Math.random() * baseDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
