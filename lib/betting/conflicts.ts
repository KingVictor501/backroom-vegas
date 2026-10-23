/*
  FILE: lib/betting/conflicts.ts
  WHAT IT'S FOR: The "picks that can't go on the same slip" rules from BET SLIP
  RULES, plus the Build your own SGP rule. Real sportsbooks refuse these
  combinations, so we do too:
  1. Both sides of the same bet            (Chiefs -3 and Seahawks +3)
  2. The over and the under on one total   (Over 47.5 and Under 47.5)
  3. Two different lines for the same bet  (Chiefs -3 and Chiefs -3.5)
  4. Anytime TD and 2+ TDs, same player    (Kelce anytime TD and Kelce 2+ TDs)
  5. Same player and stat, two lines       (Mahomes over 249.5 and over 274.5 passing yards)
  6. Moneyline and spread on the same team (Chiefs to win and Chiefs -3)
  7. In an SGP, every pick must come from the SGP's game
  Picks from the same game that don't overlap (a spread plus a player's
  receiving yards) are allowed.
  WHO USES IT: components/betslip/BetSlipProvider.tsx (to show the conflict
  popup before saving) and lib/db/betslips.ts (so the server refuses a bad
  combination too, even one sent from Postman). Tests: lib/betting/conflicts.test.ts.
  WHY THIS NAME: It finds conflicts between picks. It's in lib/betting with the
  other betting rules. It ends in .ts because it shows nothing on screen. It has
  no secrets or database code, so it runs in the browser AND on the server.
*/

// THE shared pick type from the types folder, so these rules check exactly what gets saved.
import type { BetPick } from "@/types";

/*
  ConflictReason: a short label for which rule was broken, so code (and tests)
  can tell the rules apart.
*/
export type ConflictReason =
  | "both-sides"
  | "over-and-under"
  | "different-line"
  | "anytime-and-2plus-tds"
  | "moneyline-and-spread"
  | "sgp-other-game";

/*
  Conflict: what the popup needs to explain the problem.
  conflictsWith is the pick already on the slip that clashes, or null (missing
  on purpose) for the SGP rule, which is about the game, not one pick.
  <P> means "whatever kind of pick was checked" (a full BetPick by default).
*/
export type Conflict<P = BetPick> = {
  reason: ConflictReason;
  message: string;
  conflictsWith: P | null;
};

/*
  The only fields the rules look at. Using Pick<> means a pick that hasn't been
  saved yet (no addedAt) can be checked too.
*/
export type CheckablePick = Pick<BetPick, "gameId" | "marketKey" | "period" | "participant" | "side" | "line" | "label">;

/* TOUCHDOWN_MARKETS: "anytime TD" and "2+ TDs" count as the same bet on one player (rule 4). */
const TOUCHDOWN_MARKETS = new Set(["player_anytime_td", "player_tds_over"]);

/*
  baseMarket: a market's name without "alternate" or the period ending, so
  related markets count as the same bet:
    "alternate_spreads" → "spreads"     "spreads_h1" → "spreads"
    "player_pass_yds_alternate" → "player_pass_yds"
  (The period is compared separately, so a 1st-half spread and a full-game spread don't clash.)
*/
export function baseMarket(marketKey: string): string {
  return marketKey
    .replace(/_(h1|h2|q1|q2|q3|q4)$/, "")
    .replace(/^alternate_/, "")
    .replace(/_alternate$/, "");
}

/*
  betFamily: which "bet" a pick belongs to. Two picks in the same family are
  the same bet, so they can't both be on a slip (rules 1 to 5).
  - Home/away picks (spread, winner): the bet is about the game, so the
    participant is left out. That's what makes "Chiefs -3" and "Seahawks +3" the same bet.
  - Over/under and yes/no picks: the bet is about one player, team, or the game,
    so the participant is included. Mahomes's passing yards and Allen's passing
    yards are different bets.
  - Anytime TD and 2+ TDs share one family (rule 4).
*/
function betFamily(pick: CheckablePick): string {
  const base = baseMarket(pick.marketKey);
  const market = TOUCHDOWN_MARKETS.has(base) ? "player_tds" : base;
  const isTeamSide = pick.side === "home" || pick.side === "away";
  const who = isTeamSide ? "" : (pick.participant.id ?? pick.participant.name.toLowerCase());
  return [pick.gameId, market, pick.period, who].join("|");
}

/*
  explain: picks the right rule and message for two picks in the same family.
*/
function explain(existing: CheckablePick, incoming: CheckablePick): Pick<Conflict, "reason" | "message"> {
  const existingBase = baseMarket(existing.marketKey);
  const incomingBase = baseMarket(incoming.marketKey);
  if (existingBase !== incomingBase && TOUCHDOWN_MARKETS.has(existingBase) && TOUCHDOWN_MARKETS.has(incomingBase)) {
    return {
      reason: "anytime-and-2plus-tds",
      message: `"${existing.label}" is already on your slip. Anytime TD and 2+ TDs for the same player can't go on the same slip.`,
    };
  }
  if (existing.side !== incoming.side) {
    const isTotal = existing.side === "over" || existing.side === "under";
    return isTotal
      ? {
          reason: "over-and-under",
          message: `"${existing.label}" is already on your slip. You can't take the over and the under on the same bet.`,
        }
      : {
          reason: "both-sides",
          message: `"${existing.label}" is already on your slip. You can't bet both sides of the same bet.`,
        };
  }
  return {
    reason: "different-line",
    message: `"${existing.label}" is already on your slip. You can only have one line for the same bet.`,
  };
}

/*
  isMoneylineAndSpread: true for rule 6, the winner and the spread on the SAME
  team, in the same game and the same part of the game.
*/
function isMoneylineAndSpread(a: CheckablePick, b: CheckablePick): boolean {
  const markets = new Set([baseMarket(a.marketKey), baseMarket(b.marketKey)]);
  return (
    markets.has("h2h") &&
    markets.has("spreads") &&
    a.gameId === b.gameId &&
    a.period === b.period &&
    a.side === b.side
  );
}

/*
  findConflict: checks ONE new pick against the picks already on a slip.
  - slipPicks: the slip's current picks
  - incoming: the pick the user just tapped
  - sgpGameId: the game the slip is locked to if it's a Build your own SGP slip, or null
  Returns the first conflict found, or null if the pick is allowed (null is
  missing on purpose: there's no conflict to show).
  Tapping a pick that's ALREADY on the slip isn't a conflict. It removes the
  pick, and the slip code checks for that before calling this.
*/
export function findConflict<P extends CheckablePick>(
  slipPicks: readonly P[],
  incoming: CheckablePick,
  sgpGameId: string | null,
): Conflict<P> | null {
  if (sgpGameId !== null && incoming.gameId !== sgpGameId) {
    return {
      reason: "sgp-other-game",
      message: "SGP picks must all come from the same game.",
      conflictsWith: null,
    };
  }

  const incomingFamily = betFamily(incoming);
  for (const existing of slipPicks) {
    if (betFamily(existing) === incomingFamily) {
      return { ...explain(existing, incoming), conflictsWith: existing };
    }
    if (isMoneylineAndSpread(existing, incoming)) {
      return {
        reason: "moneyline-and-spread",
        message: `"${existing.label}" is already on your slip. The winner (moneyline) and the spread on the same team can't go on the same slip.`,
        conflictsWith: existing,
      };
    }
  }
  return null;
}

/*
  findConflictInList: checks a WHOLE list of picks, for the server. It adds them
  one at a time, the way a user would tap them, and stops at the first conflict.
  Used when a slip is saved, so a bad combination can't be stored even if it
  didn't come from our own buttons.
*/
export function findConflictInList<P extends CheckablePick>(
  picks: readonly P[],
  sgpGameId: string | null,
): Conflict<P> | null {
  for (let i = 0; i < picks.length; i += 1) {
    const conflict = findConflict(picks.slice(0, i), picks[i], sgpGameId);
    if (conflict) return conflict;
  }
  return null;
}
