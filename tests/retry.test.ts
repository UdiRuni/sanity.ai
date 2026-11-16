import { describe, expect, it } from "vitest";
import { pgErrorCode, withMigrationRetry } from "../src/db/retry";

const pgError = (code: string) => Object.assign(new Error("pg"), { code });
const wrapped = (code: string) => new Error("Failed query: CREATE TABLE ...", { cause: pgError(code) });
const fast = { baseDelayMs: 1 };

describe("pgErrorCode", () => {
  it("reads the code from the error or its cause chain", () => {
    expect(pgErrorCode(pgError("23505"))).toBe("23505");
    expect(pgErrorCode(wrapped("42P07"))).toBe("42P07");
  });
  it("ignores codes that are not Postgres codes, and non-errors", () => {
    expect(pgErrorCode(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBeUndefined();
    expect(pgErrorCode(new Error("x"))).toBeUndefined();
    expect(pgErrorCode(null)).toBeUndefined();
    expect(pgErrorCode("boom")).toBeUndefined();
  });
  it("stops on a circular cause chain", () => {
    const e = new Error("loop") as Error & { cause?: unknown };
    e.cause = e;
    expect(pgErrorCode(e)).toBeUndefined();
  });
});

describe("withMigrationRetry", () => {
  it("returns at once when the run succeeds", async () => {
    let calls = 0;
    expect(await withMigrationRetry(async () => ++calls, fast)).toBe(1);
  });
  it("runs again after losing a race, including a wrapped error", async () => {
    let calls = 0;
    const result = await withMigrationRetry(async () => {
      calls++;
      if (calls === 1) throw wrapped("23505");
      if (calls === 2) throw pgError("42P07");
      return "done";
    }, fast);
    expect(result).toBe("done");
    expect(calls).toBe(3);
  });
  it("does not retry other errors", async () => {
    let calls = 0;
    await expect(
      withMigrationRetry(async () => {
        calls++;
        throw pgError("42601"); // syntax error
      }, fast),
    ).rejects.toThrow("pg");
    expect(calls).toBe(1);
  });
  it("gives up after the attempt limit and throws the last error", async () => {
    let calls = 0;
    await expect(
      withMigrationRetry(
        async () => {
          calls++;
          throw wrapped("23505");
        },
        { attempts: 3, baseDelayMs: 1 },
      ),
    ).rejects.toThrow("Failed query");
    expect(calls).toBe(3);
  });
});
