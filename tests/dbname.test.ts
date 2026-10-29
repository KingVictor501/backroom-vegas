/*
  FILE: tests/dbname.test.ts
  WHAT IT'S FOR: Checks that a missing MONGODB_DB can never quietly send testing to the LIVE database: outside the
  live site (Vercel "production") it is an error.
  WHO USES IT: `npm test` (Vitest).
  WHY THIS NAME: It tests the database-name rule in lib/db/mongodb.ts; ".test.ts" is how Vitest finds test files.
*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { connectToDatabase } from "@/lib/db/mongodb";

afterEach(() => vi.unstubAllEnvs());

describe("connectToDatabase: which database", () => {
  it("refuses to guess when MONGODB_DB is missing on a preview or local run", async () => {
    vi.stubEnv("MONGODB_DB", undefined as unknown as string);
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(connectToDatabase()).rejects.toThrow("MONGODB_DB is missing");
    vi.stubEnv("VERCEL_ENV", undefined as unknown as string);
    await expect(connectToDatabase()).rejects.toThrow("MONGODB_DB is missing");
  });
});
