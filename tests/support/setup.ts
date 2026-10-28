/*
  FILE: tests/support/setup.ts
  WHAT IT'S FOR: Runs at the start of EVERY test file, before the test's own
  imports. It makes the test world safe and complete:
  1. Points the app at the throwaway test database (never dev or live), and
     refuses to run at all if the address isn't a local in-memory one.
  2. Gives each test file its OWN empty database name, so test files running at
     the same time can't disturb each other.
  3. Fills in the settings the app needs (a random login secret, the app address).
     The secret is made up fresh on every run. No real secret is used or stored.
  4. Swaps three pieces of Next.js that only work inside a real web request:
     - "server-only" (a build-time guard) becomes a harmless empty module
     - "next/headers" cookies() becomes our pretend cookie jar
     - "next/navigation" redirect() throws an error reading "REDIRECT:<where>",
       so a test can check where the app tried to send the visitor
  5. Closes the database connection when the test file finishes.
  WHO USES IT: Vitest, because vitest.config.mts lists it under "setupFiles".
  WHY THIS NAME: Vitest calls this kind of file a "setup file". It sits in
  tests/support with the other helpers. It ends in .ts because it shows nothing on screen.
*/

import { randomBytes, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, inject, vi } from "vitest";

// The address of the throwaway database started by tests/support/globalSetup.ts.
const mongoUri = inject("mongoUri");

// SAFETY: only a database running on THIS computer is allowed. This stops a test
// from ever touching Atlas (dev or live), even if someone edits this file by mistake.
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(mongoUri)) {
  throw new Error("Tests may only use the local in-memory database.");
}

process.env.MONGODB_URI = mongoUri;
// A unique database name per test file. "test_" at the start marks it as a test database.
process.env.MONGODB_DB = `test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
// A fresh random login secret every run (64 characters; the app needs at least 32).
process.env.AUTH_SECRET = randomBytes(32).toString("hex");
process.env.APP_URL = "http://localhost:3000";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";
// Tests must never spend The Odds API credits, so there is no key.
delete process.env.ODDS_API_KEY;

// "server-only" would stop the file from loading outside Next.js, so replace it with nothing.
vi.mock("server-only", () => ({}));

// Hand the app our pretend cookie jar instead of the real visitor's cookies.
vi.mock("next/headers", async () => {
  const { cookieJar } = await import("./cookies");
  return { cookies: async () => cookieJar };
});

// redirect() normally ends the request. Here it throws "REDIRECT:/where" so tests can see where it went.
vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

// When this test file is done, close the database connection (if one was opened) so the run can end cleanly.
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});
