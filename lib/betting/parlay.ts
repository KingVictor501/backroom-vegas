/*
  FILE: lib/betting/parlay.ts
  WHAT IT'S FOR: The betting math. It checks that odds are real American odds,
  combines several picks' odds into one parlay price, and works out a slip's type
  (Straight, Parlay, or SGP).
  WHO USES IT: app/api/dev/db-test/route.ts (the Section 3 test). Later: the bet
  slip API (Section 7), which uses it so the SERVER decides the type and price
  instead of trusting the browser, and the slip bar (Section 8) for instant updates.
  WHY THIS NAME: It lives in lib/betting ("lib" = helper code). "parlay" because
  combining odds is parlay math. It ends in .ts because it shows nothing on screen.
  It doesn't touch the database or any secrets, so it's safe to use in the browser too.
*/

// The shared odds and bet slip types, so this math speaks the same language as the rest of the app.
import type { AmericanOdds, BetPick, BetSlipType } from "@/types";

/*
  HOW AMERICAN ODDS WORK (plain English)
  - Negative odds (-110): how much you'd RISK to win $100. -110 means risk $110 to win $100.
  - Positive odds (+150): how much you'd WIN on a $100 bet. +150 means bet $100, win $150.
  - Real American odds are always at least 100 in size: -110 and +150 are real,
    but -50 or +20 are not. Even money is +100 (or -100, the same thing).

  WHY WE CONVERT TO "DECIMAL ODDS" FOR PARLAYS
  Decimal odds say how much comes back for every $1 bet, INCLUDING the $1 you bet.
  - -110 → 1 + 100/110 = 1.9091 (bet $1, get back about $1.91)
  - +150 → 1 + 150/100 = 2.5    (bet $1, get back $2.50)
  A parlay rolls everything from one pick into the next, so you just MULTIPLY
  the decimal odds together. That's hard to do with American odds directly, so we
  convert to decimal, multiply, and convert back.

  REAL EXAMPLE: Chiefs -3 at -110 plus Lions moneyline at +150
  1. Convert:  -110 → 1.9091    +150 → 2.5
  2. Multiply: 1.9091 × 2.5 = 4.7727 (bet $1, get back $4.77)
  3. Convert back: 4.7727 is 2 or more, so it's positive American odds:
     (4.7727 − 1) × 100 = 377.27 → rounded to +377
  So a $100 parlay would win $377.
*/

/*
  isValidAmericanOdds: true if the number is real American odds: a whole number
  that's +100 or more, or -100 or less. Rejects things like 0, 50, -20, 1.5, or "not a number".
*/
export function isValidAmericanOdds(odds: number): boolean {
  return Number.isInteger(odds) && (odds >= 100 || odds <= -100);
}

/*
  americanToDecimal: turns American odds into decimal odds.
  - Positive: 1 + odds / 100           (+150 → 2.5)
  - Negative: 1 + 100 / (odds without the minus sign)   (-110 → 1.9091)
*/
export function americanToDecimal(odds: AmericanOdds): number {
  if (!isValidAmericanOdds(odds)) {
    throw new RangeError(`${odds} isn't valid American odds.`);
  }
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

/*
  decimalToAmerican: turns decimal odds back into American odds, rounded to a whole number.
  - Decimal 2 or more → positive: (decimal − 1) × 100        (4.7727 → +377)
  - Decimal under 2  → negative: −100 / (decimal − 1)        (1.9091 → -110)
*/
export function decimalToAmerican(decimal: number): AmericanOdds {
  if (!Number.isFinite(decimal) || decimal <= 1) {
    throw new RangeError(`${decimal} isn't valid decimal odds.`);
  }
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1));
}

/*
  combineParlayOdds: the combined price for a list of picks' odds.
  - No odds → null (an empty slip has nothing to combine).
  - One pick → that pick's own odds (a straight bet).
  - Two or more → multiply their decimal odds, then convert back (see the example above).
  Examples: [-110, +150] → +377.  [-110, -110, -110] → +596 (the classic 3-team parlay).
*/
export function combineParlayOdds(
  oddsList: readonly AmericanOdds[],
): AmericanOdds | null {
  if (oddsList.length === 0) return null;
  if (oddsList.length === 1) {
    // Still check it, so a bad single price can't slip through.
    americanToDecimal(oddsList[0]);
    return oddsList[0];
  }
  const combinedDecimal = oddsList.reduce(
    (total, odds) => total * americanToDecimal(odds),
    1,
  );
  return decimalToAmerican(combinedDecimal);
}

/*
  getBetSlipType: works out the slip type from its picks (the rules from BET SLIP RULES).
  - 0 or 1 pick → "straight"
  - 2+ picks, all from ONE game → "sgp"
  - 2+ picks from MORE THAN ONE game → "parlay"
  Only each pick's gameId matters here.
*/
export function getBetSlipType(
  picks: readonly { gameId: string }[],
): BetSlipType {
  if (picks.length < 2) return "straight";
  // A Set keeps only unique values, so its size is how many different games there are.
  const differentGames = new Set(picks.map((pick) => pick.gameId)).size;
  return differentGames === 1 ? "sgp" : "parlay";
}

/*
  SlipPricing: the three values the server calculates for every slip.
*/
export type SlipPricing = {
  type: BetSlipType;
  combinedOdds: AmericanOdds | null;
  /**
   * true for SGPs. Picks from the same game are connected (if the Chiefs win big,
   * Mahomes probably threw for a lot of yards), so sportsbooks pay LESS than the
   * simple multiplication above. Our number is only an estimate for SGPs.
   */
  oddsAreEstimated: boolean;
};

/*
  getSlipPricing: works out a slip's type, combined odds, and "estimated" flag in one step.
  The bet slip API calls this every time a slip is saved, so these values always
  come from the server's own math, never from the browser.
  Pick<BetPick, "gameId" | "odds"> uses TypeScript's built-in "Pick" tool (the
  reason our pick type is called BetPick). It means "a BetPick, but we only need
  its gameId and odds".
*/
export function getSlipPricing(
  picks: readonly Pick<BetPick, "gameId" | "odds">[],
): SlipPricing {
  const type = getBetSlipType(picks);
  return {
    type,
    combinedOdds: combineParlayOdds(picks.map((pick) => pick.odds)),
    oddsAreEstimated: type === "sgp",
  };
}
