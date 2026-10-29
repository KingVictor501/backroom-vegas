/*
  FILE: scripts/check-invite-code.ts
  WHAT IT'S FOR: A small READ-ONLY program YOU run in the terminal when an invite code "isn't valid"
  and you don't know why. It never changes anything and never prints a code or the database address.
  It tells you:
  - which database it connected to, and how many invite codes that database has
  - a safe summary of each code (its note, uses, expiry, and on/off) with the code itself hidden
  - if you give it the code you typed with --try, exactly WHY the website would accept or refuse it
    (wrong shape, not found in this database, used up, expired, or turned off)

  HOW TO RUN IT (from the project folder):
    npm run invite:check -- --db backroom-vegas
    npm run invite:check -- --db backroom-vegas --try "BRV-XXXX-XXXX"
  The code you type stays in your own terminal. Don't paste it into chat.

  WHERE THE DATABASE ADDRESS COMES FROM: the shortcut loads .env.local (see package.json), like invite:create.
  WHO USES IT: you, in the terminal. The website never runs it.
  WHY THIS NAME / LOCATION: scripts/ holds programs you run by hand. It ends in .ts like the rest of the project;
  Node runs .ts files directly, so the import below spells out ".ts".
  WHY IT REPEATS THE "GOOD CODE" RULE: the website's own rule lives in a file locked to the website
  ("server-only"), which plain Node can't load. The rule here is the same three checks, and tests/invite.test.ts
  checks the website's version.
*/

import { parseArgs } from "node:util";
import mongoose from "mongoose";
// normalizeInviteCode: tidies what was typed and checks its shape (the same function the website uses).
import { normalizeInviteCode } from "../lib/invite/format.ts";

/** The collection MongoDB keeps invite codes in (same as scripts/create-invite-code.ts). */
const COLLECTION_NAME = "invitecodes";

/* InviteDoc: the fields we read. expiresAt is null when the code never expires (missing on purpose). */
type InviteDoc = {
  code: string;
  note?: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  active: boolean;
  createdAt?: Date;
};

/* fail: prints the problem and stops. */
function fail(message: string): never {
  console.error(`\nProblem: ${message}\n`);
  process.exit(1);
}

/* why: the reason the website would refuse this record, or "OK" if it would accept it. */
function why(record: InviteDoc, now: Date): string {
  if (!record.active) return "REFUSED: the code is turned off (active is false).";
  if (record.usedCount >= record.maxUses) return "REFUSED: the code is used up.";
  if (record.expiresAt !== null && record.expiresAt.getTime() <= now.getTime()) return "REFUSED: the code has expired.";
  return "OK: the website would accept this code.";
}

/* main: connect (read-only), print the summary, and explain the --try code if there is one. */
async function main(): Promise<void> {
  const { values } = parseArgs({ options: { db: { type: "string" }, try: { type: "string" } }, strict: true });
  const databaseName = values.db;
  if (!databaseName) fail("Say which database to look at with --db (backroom-vegas-dev or backroom-vegas).");
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(databaseName)) fail("--db can only contain letters, numbers, dashes, and underscores.");
  const uri = process.env.MONGODB_URI;
  if (!uri) fail("MONGODB_URI is missing. Run this with `npm run invite:check`, which loads .env.local.");

  const connection = await mongoose.createConnection(uri, { dbName: databaseName, serverSelectionTimeoutMS: 10_000 }).asPromise();
  try {
    const codes = connection.collection<InviteDoc>(COLLECTION_NAME);
    const all = await codes.find({}).sort({ createdAt: -1 }).limit(50).toArray();
    const now = new Date();
    console.log(`\nConnected to database "${databaseName}". Invite codes found: ${all.length}\n`);
    for (const record of all) {
      const shape = normalizeInviteCode(record.code) === null ? "BAD SHAPE" : "shape ok";
      console.log(
        `  - note: ${record.note || "(none)"} | uses: ${record.usedCount}/${record.maxUses} | ` +
          `${record.active ? "on" : "OFF"} | expires: ${record.expiresAt ? record.expiresAt.toISOString() : "never"} | ` +
          `created: ${record.createdAt ? record.createdAt.toISOString() : "?"} | ${shape} | ${why(record, now)}`,
      );
    }

    if (values.try !== undefined) {
      const typed = normalizeInviteCode(values.try);
      console.log("");
      if (typed === null) {
        console.log("Your --try code is not the right SHAPE (it should look like BRV-XXXX-XXXX with no extra characters).");
      } else {
        const found = await codes.findOne({ code: typed });
        console.log(found ? `Your --try code was found in "${databaseName}". ${why(found, now)}` : `Your --try code was NOT found in "${databaseName}".`);
      }
    }
    console.log("");
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error(`\nProblem: ${error instanceof Error ? error.message.replace(/mongodb(\+srv)?:\/\/\S+/gi, "[address hidden]") : "Something went wrong."}\n`);
  process.exit(1);
});
