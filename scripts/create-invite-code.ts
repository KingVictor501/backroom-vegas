/*
  FILE: scripts/create-invite-code.ts
  WHAT IT'S FOR: A small program YOU run in the terminal to create an invite
  code. It makes a random code (like BRV-7K2M-Q9XD), saves it in the database you
  choose, and prints it once so you can copy it. You choose how many sign ups the
  code allows, an optional expiration date, and a short note.

  HOW TO RUN IT (from the project folder):
    npm run invite:create -- --db backroom-vegas-dev --uses 10 --note "graders"
    npm run invite:create -- --db backroom-vegas-dev --uses 1 --expires 2026-12-31 --note "for Sam"
  Options:
    --db       REQUIRED. Which database: "backroom-vegas-dev" (testing) or "backroom-vegas" (LIVE).
               There is no default on purpose, so you can never pick one by accident.
    --uses     How many accounts the code may create. Default 1.
    --expires  Last day the code works, as YYYY-MM-DD (it works until the end of that day, UTC). Default: never.
    --note     A reminder of who it's for. Default: none.
  For the LIVE database the script makes you type the database name again to confirm.

  WHERE THE DATABASE ADDRESS COMES FROM: the "npm run invite:create" shortcut loads
  your .env.local file (see package.json) and this script reads MONGODB_URI from
  it. The address and password are never printed. To use a different address, such
  as a separate live one, run it with another file:
    node --env-file=.env.live scripts/create-invite-code.ts --db backroom-vegas --uses 10

  WHO USES IT: you, in the terminal. The website never runs it.
  WHY THIS NAME / LOCATION: scripts/ holds programs you run by hand, not parts of the
  website. It ends in .ts (TypeScript) like the rest of the project. Node runs .ts
  files directly, which is why the import below spells out the ".ts" ending.
  WHY IT DOESN'T REUSE THE APP'S DATABASE CODE: that code is locked to the website
  ("server-only") and uses shortcuts like "@/..." that plain Node doesn't understand.
  So this script writes the record directly, using the SAME code-building function
  (lib/invite/generate.ts) the tests check against the real database model.
*/

// parseArgs: Node's built-in reader for command-line options like --db and --uses.
import { parseArgs } from "node:util";
// once: waits for a single event to happen (used to notice the keyboard input closing).
import { once } from "node:events";
// readline: asks a question in the terminal and waits for you to type an answer (used to confirm LIVE).
import { createInterface } from "node:readline/promises";
// mongoose: the same database library the website uses.
import mongoose from "mongoose";
// newInviteCodeFields: checks the choices and builds the record (the code, uses, expiry, note).
import { newInviteCodeFields } from "../lib/invite/generate.ts";

/** The LIVE database's name. Creating a code here asks for an extra confirmation. */
const LIVE_DATABASE = "backroom-vegas";

/** The collection MongoDB keeps invite codes in. Mongoose names it from the model "InviteCode". */
const COLLECTION_NAME = "invitecodes";

/* fail: prints a plain-English problem and the example, then stops the program (exit code 1 = "something went wrong"). */
function fail(message: string): never {
  console.error(`\nProblem: ${message}\n`);
  console.error('Example: npm run invite:create -- --db backroom-vegas-dev --uses 10 --note "graders"\n');
  process.exit(1);
}

/* main: reads your choices, builds the code, saves it, and prints it. */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      db: { type: "string" },
      uses: { type: "string", default: "1" },
      expires: { type: "string" },
      note: { type: "string", default: "" },
    },
    strict: true,
  });

  // --db is required, and only plain database-name characters are allowed.
  const databaseName = values.db;
  if (!databaseName) fail("Say which database to use with --db (backroom-vegas-dev or backroom-vegas).");
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(databaseName)) fail("--db can only contain letters, numbers, dashes, and underscores.");

  // --expires: YYYY-MM-DD, kept until the very end of that day in UTC.
  let expiresAt: Date | null = null;
  if (values.expires !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.expires)) fail("--expires must look like 2026-12-31.");
    expiresAt = new Date(`${values.expires}T23:59:59.999Z`);
    if (Number.isNaN(expiresAt.getTime())) fail("That --expires date isn't a real date.");
  }

  // Build and check the record. It throws a plain-English Error if a choice is out of range.
  let fields;
  try {
    fields = newInviteCodeFields({ maxUses: Number(values.uses), expiresAt, note: values.note ?? "" });
  } catch (error) {
    fail(error instanceof Error ? error.message : "Those choices aren't valid.");
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) fail("MONGODB_URI is missing. Run this with `npm run invite:create`, which loads .env.local.");

  // The LIVE database needs a typed confirmation.
  if (databaseName === LIVE_DATABASE) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    // Race the typed answer against the input closing (like pressing Ctrl-D, or no
    // keyboard at all). If the input closes first, the answer is "" = not confirmed,
    // so the script stops instead of waiting forever.
    const answer = await Promise.race([
      rl.question(`\nThis creates a code in the LIVE database "${LIVE_DATABASE}".\nType ${LIVE_DATABASE} to confirm: `),
      once(rl, "close").then(() => ""),
    ]);
    rl.close();
    if (answer.trim() !== LIVE_DATABASE) fail("Not confirmed. Nothing was created.");
  }

  // Connect to the database you chose, save the record, and always disconnect afterward.
  const connection = await mongoose.createConnection(uri, { dbName: databaseName, serverSelectionTimeoutMS: 10_000 }).asPromise();
  try {
    const codes = connection.collection(COLLECTION_NAME);
    // Make sure two records can never share a code (the website's model asks for the same rule).
    await codes.createIndex({ code: 1 }, { unique: true });
    const now = new Date();
    await codes.insertOne({ ...fields, createdAt: now, updatedAt: now });
  } finally {
    await connection.close();
  }

  console.log(`\nCreated an invite code in "${databaseName}":\n`);
  console.log(`   ${fields.code}\n`);
  console.log(`   Sign ups allowed: ${fields.maxUses}`);
  console.log(`   Expires:          ${fields.expiresAt ? fields.expiresAt.toISOString() : "never"}`);
  console.log(`   Note:             ${fields.note || "(none)"}\n`);
  console.log("Copy it now. Keep it out of chat messages and public places.\n");
}

main().catch((error: unknown) => {
  // Only the error's name and message: the full error could contain the database address.
  console.error(`\nProblem: ${error instanceof Error ? error.message.replace(/mongodb(\+srv)?:\/\/\S+/gi, "[address hidden]") : "Something went wrong."}\n`);
  process.exit(1);
});
