/*
  FILE: app/api/dev/db-test/route.ts
  WHAT IT'S FOR: A TEMPORARY test for Section 3. Sending it a POST request saves
  one test bet slip to MongoDB using the BetSlip model and the parlay math, then
  reads it back from the database and shows you both.
  It only works on your computer (npm run dev). On the live Vercel site it always
  answers "not found", so no stranger can write junk into your database.
  We'll delete this file once you've checked the record in Atlas.
  WHO USES IT: Only you, from Postman. No page uses it.
  WHY THIS NAME: app/api/dev/db-test becomes the address /api/dev/db-test ("dev"
  = for development only). API route files must be named "route", and it ends in
  .ts because it sends back data, not a screen.
*/

import { Types } from "mongoose";
// connectToDatabase from lib/db/mongodb.ts: the one shared database connection.
import { connectToDatabase } from "@/lib/db/mongodb";
// The BetSlip model and its converter, from lib/db/models/BetSlip.ts.
import { BetSlipModel, toBetSlip } from "@/lib/db/models/BetSlip";
// getSlipPricing from lib/betting/parlay.ts. The server works out the type and odds itself.
import { getSlipPricing } from "@/lib/betting/parlay";
// The shared pick type, so the test picks have exactly the shape real picks will have.
import type { BetPick } from "@/types";

/*
  POST: saves a test slip, reads it back, and returns both.
  There's no request body to check: this route ignores anything sent to it and
  always saves the same fixed test data written below.
*/
export async function POST() {
  // SAFETY: on the live site (production), pretend this route doesn't exist.
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: { code: "not-found", message: "Not found." } },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();

  // Two made-up picks from DIFFERENT games, so the slip should come out as a
  // "parlay" at +377 (see the worked example in lib/betting/parlay.ts).
  const testPicks: BetPick[] = [
    {
      id: "test-game-1|spreads|full-game|team:KC|away|-3",
      gameId: "test-game-1",
      league: "nfl",
      gameLabel: "KC @ LV",
      gameStartsAt: now,
      marketKey: "spreads",
      marketCategory: "game-lines",
      marketLabel: "Spread",
      period: "full-game",
      participant: { kind: "team", id: null, name: "Kansas City Chiefs" },
      side: "away",
      line: -3,
      odds: -110,
      sportsbook: "hardrockbet",
      label: "Chiefs -3",
      addedAt: now,
    },
    {
      id: "test-game-2|h2h|full-game|team:DET|home|none",
      gameId: "test-game-2",
      league: "nfl",
      gameLabel: "GB @ DET",
      gameStartsAt: now,
      marketKey: "h2h",
      marketCategory: "game-lines",
      marketLabel: "Winner",
      period: "full-game",
      participant: { kind: "team", id: null, name: "Detroit Lions" },
      side: "home",
      line: null,
      odds: 150,
      sportsbook: "betmgm",
      label: "Lions to win",
      addedAt: now,
    },
  ];

  try {
    await connectToDatabase();

    // 1. SAVE. The type, combined odds, and "estimated" flag come from the server's own math.
    const created = await BetSlipModel.create({
      // A random made-up owner ID, since real users don't exist until Section 4.
      userId: new Types.ObjectId(),
      // The time is added to the name so you can run the test more than once
      // without breaking the "unique name per user" rule.
      name: `TEST delete me ${now.slice(11, 19)}`,
      sgpGameId: null,
      picks: testPicks,
      ...getSlipPricing(testPicks),
    });

    // 2. READ IT BACK from the database (a fresh read, not the copy we already have).
    // .lean() gives a plain object instead of a full Mongoose document.
    const readBack = await BetSlipModel.findById(created._id).lean();
    if (!readBack) {
      return Response.json(
        { error: { code: "server-error", message: "Saved, but couldn't read it back." } },
        { status: 500 },
      );
    }

    return Response.json(
      {
        message: "Saved a test bet slip and read it back. Find it in Atlas in the betslips collection.",
        betSlip: toBetSlip(readBack),
      },
      // 201 = "Created".
      { status: 201 },
    );
  } catch (error) {
    // The full error goes to your terminal only. The response stays friendly and leaks no details.
    console.error("DB test failed:", error);
    return Response.json(
      { error: { code: "server-error", message: "The database test failed. Check the terminal for details." } },
      { status: 500 },
    );
  }
}
