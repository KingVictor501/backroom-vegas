/*
  FILE: vitest.config.mts
  WHAT IT'S FOR: Settings for Vitest, the tool that runs our automatic tests
  (files ending in .test.ts). Run them with: npm test
  - tsconfigPaths: true lets tests understand "@/..." imports, the same way
    Next.js does. (The Next.js guide uses a plugin for this, but Vite, which
    Vitest runs on, can now do it by itself.)
  - environment "node": our tests check plain logic (no screens), so they don't need a fake browser.
  - globalSetup: starts a throwaway in-memory MongoDB once for the whole run, so
    tests NEVER touch the dev database (backroom-vegas-dev) or the live one.
  - setupFiles: runs before every test file to point the app at that throwaway
    database and to swap in pretend cookies (see tests/support/setup.ts).
  - hookTimeout is long only because the very first run downloads MongoDB (one time).
  WHO USES IT: Vitest reads it when you run npm test. The app itself never uses it.
  WHY THIS NAME: Vitest looks for a file with exactly this name. ".mts" is a
  TypeScript file that uses modern "import" syntax, which config files need. It
  follows the Next.js Vitest guide (node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md).
*/

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    globalSetup: ["./tests/support/globalSetup.ts"],
    setupFiles: ["./tests/support/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 300_000,
  },
});
