/*
  FILE: lib/db/betslipCopy.ts
  WHAT IT'S FOR: Copies one of the logged-in user's bet slips into a brand-new slip:
  1. Finds the slip, ONLY if it belongs to this user (someone else's slip ID acts like a fake ID).
  2. Looks up the current odds at the user's sportsbook (lib/services/slipOdds.ts).
  3. Applies the copy rules (lib/betting/copySlip.ts): skip games that already started or
     finished, refresh the rest, keep old prices where the book has none.
  4. Saves the new slip, named "Copy of <name>", with a note of what was skipped, and makes it
     the user's active slip.
  The new slip always belongs to the same user. The original is never changed.
  WHO USES IT: app/api/betslips/[id]/copy/route.ts.
  WHY THIS NAME: It's the database code for copying a slip, next to betslips.ts. It ends in .ts
  because it shows nothing on screen.
*/

import "server-only";
import { copySlipName, planSlipCopy } from "@/lib/betting/copySlip";
import { createBetSlip, getBetSlip } from "@/lib/db/betslips";
import { BetSlipModel } from "@/lib/db/models/BetSlip";
import { getCurrentOddsForPicks } from "@/lib/services/slipOdds";
import type { BetSlip, User } from "@/types";

/*
  copyBetSlip: see the top of this file. Gives back the new slip, or null if the slip isn't
  found or isn't this user's (missing on purpose: the route answers "404 not found" for both).
  `now` is a parameter so tests can pretend it's another day.
*/
export async function copyBetSlip(user: User, slipId: string, now: Date = new Date()): Promise<BetSlip | null> {
  // OWNERSHIP: getBetSlip includes the user's ID in its search.
  const original = await getBetSlip(user.id, slipId);
  if (!original) return null;

  const { odds, gameStatuses } = await getCurrentOddsForPicks(original.picks, user.preferredSportsbook, now);
  const plan = planSlipCopy({ picks: original.picks, odds, gameStatuses, sportsbook: user.preferredSportsbook, now });

  // A "Build your own SGP" slip stays locked to its game only if some picks from that game survive.
  const sgpGameId =
    original.sgpGameId !== null && plan.picks.some((pick) => pick.gameId === original.sgpGameId) ? original.sgpGameId : null;

  // "Copy of X", or room for "(2)", "(3)" if that name is taken. createBetSlip adds the number.
  const plainName = copySlipName(original.name);
  const taken = await BetSlipModel.exists({ userId: user.id, name: plainName });
  const name = taken ? copySlipName(original.name, true) : plainName;

  return createBetSlip(user.id, {
    name,
    picks: plan.picks,
    sgpGameId,
    setActive: true,
    numberIfTaken: true,
    copiedFrom: {
      fromName: original.name,
      sportsbook: user.preferredSportsbook,
      skipped: plan.skipped,
      copiedAt: now.toISOString(),
    },
  });
}
