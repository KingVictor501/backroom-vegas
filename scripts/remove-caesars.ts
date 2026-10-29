/*
  FILE: scripts/remove-caesars.ts
  WHAT IT'S FOR: A one-time clean-up after Caesars was removed from the app. In ONE database of your choice it:
  1. switches every user whose sportsbook is Caesars to Hard Rock Bet
  2. removes every pick that came from Caesars from the slips that hold it, then works out each slip's type
     and combined odds again (the same math the app uses), and fixes slips that were copied with Caesars notes:
     a "copied from" note naming Caesars is switched to Hard Rock Bet, and any pick's old-price note naming
     Caesars is switched to Hard Rock Bet.
  By default it only LOOKS and prints what it would change (a "dry run"). Nothing is changed unless you add --apply.
  HOW TO RUN IT (it reads MONGODB_URI from .env.local, and you choose the database):
    npm run caesars:remove -- --db backroom-vegas-dev            (look only)
    npm run caesars:remove -- --db backroom-vegas-dev --apply    (really change it)
    npm run caesars:remove -- --db backroom-vegas                (look at the LIVE database)
    npm run caesars:remove -- --db backroom-vegas --apply        (really change the LIVE database)
  It prints counts only. It never prints emails, passwords, or the connection string.
  Safe to run twice: the second run finds nothing left to change.
  WHO USES IT: you, once per database, from the terminal (see package.json: caesars:remove).
  WHY THIS NAME/ENDING: a script, not part of the website. It ends in .ts (not .tsx) because it shows nothing
  on screen. Node runs .ts files directly, so the import below spells out ".ts".
*/

import { parseArgs } from "node:util";
import mongoose from "mongoose";
// getSlipPricing from lib/betting/parlay.ts: the app's own slip math (type, combined odds, "estimated").
import { getSlipPricing } from "../lib/betting/parlay.ts";

/* The word being removed, as it is stored in the database. */
const REMOVED_BOOK = "caesars";
/* The book everyone is moved to (config/sportsbooks.ts: DEFAULT_SPORTSBOOK). */
const REPLACEMENT_BOOK = "hardrock";

/* The small part of a stored pick and slip that this script reads. */
type StoredPick = { gameId: string; odds: number; sportsbook: string; refresh?: { previousSportsbook?: string } };
type StoredSlip = { _id: unknown; picks: StoredPick[]; copiedFrom?: { sportsbook?: string } | null };

/* fail: prints a plain message and stops. */
function fail(message: string): never {
  console.error(`\nProblem: ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { db: { type: "string" }, apply: { type: "boolean" } }, strict: true });
  const databaseName = values.db;
  if (!databaseName) fail("Say which database with --db (backroom-vegas-dev or backroom-vegas).");
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(databaseName)) fail("--db can only contain letters, numbers, dashes, and underscores.");
  const uri = process.env.MONGODB_URI;
  if (!uri) fail("MONGODB_URI is missing. Run this with `npm run caesars:remove`, which loads .env.local.");
  const apply = values.apply === true;

  const connection = await mongoose.createConnection(uri, { dbName: databaseName, serverSelectionTimeoutMS: 10_000 }).asPromise();
  try {
    console.log(`\nConnected to database "${databaseName}". ${apply ? "APPLYING changes." : "Dry run (nothing will be changed)."}\n`);
    const users = connection.collection("users");
    const slips = connection.collection<StoredSlip>("betslips");

    // 1. Users on Caesars → Hard Rock Bet.
    const usersOnCaesars = await users.countDocuments({ preferredSportsbook: REMOVED_BOOK });
    console.log(`Users whose sportsbook is Caesars: ${usersOnCaesars}`);
    if (apply && usersOnCaesars > 0) await users.updateMany({ preferredSportsbook: REMOVED_BOOK }, { $set: { preferredSportsbook: REPLACEMENT_BOOK } });

    // 2. Slips holding Caesars in any pick or note.
    const affected = await slips
      .find({
        $or: [{ "picks.sportsbook": REMOVED_BOOK }, { "picks.refresh.previousSportsbook": REMOVED_BOOK }, { "copiedFrom.sportsbook": REMOVED_BOOK }],
      })
      .toArray();
    let picksRemoved = 0;
    for (const slip of affected) {
      const kept = slip.picks.filter((pick) => pick.sportsbook !== REMOVED_BOOK);
      picksRemoved += slip.picks.length - kept.length;
      const cleaned = kept.map((pick) =>
        pick.refresh?.previousSportsbook === REMOVED_BOOK ? { ...pick, refresh: { ...pick.refresh, previousSportsbook: REPLACEMENT_BOOK } } : pick,
      );
      const changes: Record<string, unknown> = { picks: cleaned, ...getSlipPricing(cleaned) };
      if (slip.copiedFrom?.sportsbook === REMOVED_BOOK) changes["copiedFrom.sportsbook"] = REPLACEMENT_BOOK;
      if (apply) await slips.updateOne({ _id: slip._id } as never, { $set: changes });
    }
    console.log(`Slips that mention Caesars: ${affected.length} (Caesars picks to remove: ${picksRemoved})`);

    console.log(apply ? "\nDone. The changes above were applied.\n" : "\nDry run finished. Add --apply to make these changes.\n");
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error(`\nProblem: ${error instanceof Error ? error.message.replace(/mongodb(\+srv)?:\/\/\S+/gi, "[address hidden]") : "Something went wrong."}\n`);
  process.exit(1);
});
