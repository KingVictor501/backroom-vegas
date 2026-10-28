/*
  FILE: tests/support/globalSetup.ts
  WHAT IT'S FOR: Starts a throwaway MongoDB database ONCE before any test runs,
  and shuts it down after the last test. It lives only in your computer's memory:
  nothing is saved, and it is not your dev database (backroom-vegas-dev) or the
  live one (backroom-vegas). Every test file connects to this one instead.
  The first time you run `npm test`, the library downloads a small copy of the
  MongoDB program (about 100 MB, one time only). After that it starts in a second or two.
  WHO USES IT: Vitest, because vitest.config.mts lists it under "globalSetup".
  Its address is handed to tests/support/setup.ts, which puts it in the environment.
  WHY THIS NAME: Vitest calls a file that runs once before everything a "global
  setup". It sits in tests/support with the other helpers for tests. It ends in
  .ts because it shows nothing on screen.
*/

// mongodb-memory-server-core: runs a real MongoDB inside the test run, in memory.
import { MongoMemoryServer } from "mongodb-memory-server-core";
// TestProject: the object Vitest passes in, which lets us share a value with every test.
import type { TestProject } from "vitest/node";

// This tells TypeScript that the shared value named "mongoUri" exists and is text.
declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/* The running throwaway database, kept so teardown can stop it. undefined = not started yet. */
let server: MongoMemoryServer | undefined;

/* setup: starts the database and shares its address with every test file. */
export async function setup(project: TestProject): Promise<void> {
  server = await MongoMemoryServer.create();
  project.provide("mongoUri", server.getUri());
}

/* teardown: stops and deletes the throwaway database after the last test. */
export async function teardown(): Promise<void> {
  await server?.stop();
}
