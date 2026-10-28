/*
  FILE: lib/betting/payout.ts
  WHAT IT'S FOR: The "estimated payout" math for a bet slip. Given the wager (a PRETEND
  amount, no real money) and the picks, it works out:
  - profit: what you'd win on top of your wager
  - totalReturn: wager + profit (what you'd get back)
  - which sportsbook(s) the picks' prices came from, and whether the slip mixes books
  - whether the number is only an estimate (SGPs: real sportsbooks pay less, because
    picks from one game are connected)
  Also holds parseWager(), which turns what someone typed into the wager box into a number
  (or says why it isn't allowed), using the same limits the server uses.

  REAL EXAMPLE: $10 on a 2-pick parlay, Chiefs -110 and Lions +150
  1. Combined odds: +377 (see lib/betting/parlay.ts)... but we multiply the exact decimal
     odds, not the rounded +377: 1.9091 × 2.5 = 4.7727
  2. Profit: $10 × (4.7727 − 1) = $37.73
  3. Total return: $10 + $37.73 = $47.73

  Using the exact decimal odds (instead of the rounded American number) means the payout
  matches what an online payout calculator shows, to the cent.
  WHO USES IT: components/betslip/PayoutBox.tsx (the wager box on the slip page, slip bar, and
  desktop panel). The server doesn't need it: the server only saves the wager.
  WHY THIS NAME: It's the payout math, in lib/betting with the other slip code. It ends in .ts
  because it shows nothing on screen. It has no secrets and no database use, so the browser can use it.
*/

// americanToDecimal from lib/betting/parlay.ts: the odds conversion, so there's one copy of that math.
import { americanToDecimal } from "@/lib/betting/parlay";
// The shared wager limits and slip types from the types folder, the same ones the server checks.
import { BET_SLIP_MAX_WAGER, BET_SLIP_MIN_WAGER, type BetPick, type BetSlipType, type SportsbookId } from "@/types";

/*
  roundToCents: rounds to the nearest cent, halves going up. Number.EPSILON nudges numbers like
  1.005 (which the computer stores as 1.00499999...) up to the answer a person expects.
*/
function roundToCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/*
  PayoutEstimate: what the slip would pay.
  - profit / totalReturn are in dollars, rounded to the cent
  - isEstimate: true for SGPs (see the top of this file)
  - sportsbooks: the distinct books the picks came from, in the order they first appear
*/
export type PayoutEstimate = {
  profit: number;
  totalReturn: number;
  isEstimate: boolean;
  sportsbooks: SportsbookId[];
};

/*
  estimatePayout: the payout for a wager on these picks, or null when there are no picks
  (null is missing on purpose: an empty slip has nothing to pay).
  Straight bet: one pick's own odds. Parlay and SGP: the picks' decimal odds multiplied together.
*/
export function estimatePayout(
  picks: readonly Pick<BetPick, "odds" | "sportsbook">[],
  wager: number,
  type: BetSlipType,
): PayoutEstimate | null {
  if (picks.length === 0) return null;
  const decimal = picks.reduce((total, pick) => total * americanToDecimal(pick.odds), 1);
  const profit = roundToCents(wager * (decimal - 1));
  return {
    profit,
    totalReturn: roundToCents(wager + profit),
    isEstimate: type === "sgp",
    // A Set keeps each book once; spreading it keeps the order the books were first seen.
    sportsbooks: [...new Set(picks.map((pick) => pick.sportsbook))],
  };
}

/* formatMoney: dollars with cents and commas, like $1,234.50. */
export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/*
  WagerParse: the result of reading the wager box. Either a good number, or a plain-English reason
  it was refused (shown in red).
*/
export type WagerParse = { ok: true; wager: number } | { ok: false; message: string };

/*
  parseWager: turns what was typed ("25", "$25.50", "1,000") into a number, or explains why not.
  The limits come from types/betslip.ts, and the server checks them again (the browser can be bypassed).
*/
export function parseWager(typed: string): WagerParse {
  // Dollar signs, commas, and spaces are fine to type.
  const cleaned = typed.replace(/[$,\s]/g, "");
  if (cleaned === "") return { ok: false, message: "Enter a wager amount." };
  // Only plain numbers like 25 or 25.5. This also refuses "1e3", "0x10", "Infinity", and "-5".
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return { ok: false, message: "The wager must be a number like 10 or 25.50." };
  const wager = Number(cleaned);
  if (!/^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(cleaned)) return { ok: false, message: "The wager can have at most 2 decimal places." };
  if (wager < BET_SLIP_MIN_WAGER) return { ok: false, message: `The wager must be at least ${formatMoney(BET_SLIP_MIN_WAGER)}.` };
  if (wager > BET_SLIP_MAX_WAGER) return { ok: false, message: `The wager can be at most ${formatMoney(BET_SLIP_MAX_WAGER)}.` };
  return { ok: true, wager };
}
