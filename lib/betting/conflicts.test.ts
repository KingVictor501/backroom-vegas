/*
  FILE: lib/betting/conflicts.test.ts
  WHAT IT'S FOR: Automatic tests for every "picks that can't go together" rule
  and every Build your own SGP rule. Each test sets up picks, runs the real
  code, and checks the answer. If someone breaks a rule later, a test fails.
  Run them with: npm test
  WHO USES IT: Vitest (vitest.config.mts). The app never loads this file.
  WHY THIS NAME: It tests conflicts.ts, so it's conflicts.test.ts, right next
  to it. Vitest finds every file ending in .test.ts. It ends in .ts because it
  shows nothing on screen.
*/

// describe groups tests, it is one test, expect checks a result. All from Vitest.
import { describe, expect, it } from "vitest";
// The rules being tested, from conflicts.ts next to this file.
import { baseMarket, findConflict, findConflictInList } from "./conflicts";
// The parlay math, to test the SGP type and "Estimated" rules.
import { getSlipPricing } from "./parlay";
import type { BetPick } from "@/types";

/* The two test games: Chiefs @ Seahawks, and Chargers @ Chiefs. */
const KC_SEA = "401873022";
const LAC_KC = "401873006";

/*
  pick: makes a test pick. It starts as "Chiefs -3 at -110 in KC @ SEA", and
  each test changes only the fields it cares about.
*/
function pick(changes: Partial<BetPick> = {}): BetPick {
  return {
    id: "test",
    gameId: KC_SEA,
    league: "nfl",
    gameLabel: "KC @ SEA",
    gameStartsAt: "2026-10-26T00:20Z",
    marketKey: "spreads",
    marketCategory: "game-lines",
    marketLabel: "Spread",
    period: "full-game",
    participant: { kind: "team", id: "12", name: "Kansas City Chiefs" },
    side: "away",
    line: -3,
    odds: -110,
    sportsbook: "hardrock",
    label: "Chiefs -3",
    addedAt: "2026-10-22T20:00:00Z",
    ...changes,
  };
}

/* Ready-made picks used by several tests. */
const chiefsSpread = pick();
const seahawksSpread = pick({ side: "home", line: 3, participant: { kind: "team", id: "26", name: "Seattle Seahawks" }, label: "Seahawks +3" });
const chiefsMoneyline = pick({ marketKey: "h2h", marketLabel: "Winner", line: null, odds: 150, label: "Chiefs to win" });
const seahawksMoneyline = pick({ marketKey: "h2h", side: "home", line: null, participant: { kind: "team", id: "26", name: "Seattle Seahawks" }, label: "Seahawks to win" });
const gameOver = pick({ marketKey: "totals", side: "over", line: 47.5, participant: { kind: "game", id: null, name: "Game" }, label: "Over 47.5" });
const gameUnder = pick({ marketKey: "totals", side: "under", line: 47.5, participant: { kind: "game", id: null, name: "Game" }, label: "Under 47.5" });
const mahomes = { kind: "player", id: "3139477", name: "Patrick Mahomes" } as const;
const mahomesPassOver249 = pick({ marketKey: "player_pass_yds", marketCategory: "player-props", side: "over", line: 249.5, participant: mahomes, label: "Mahomes Over 249.5 Passing Yards" });
const kelce = { kind: "player", id: "15847", name: "Travis Kelce" } as const;
const kelceAnytimeTd = pick({ marketKey: "player_anytime_td", marketCategory: "player-props", side: "yes", line: null, participant: kelce, label: "Kelce Anytime TD" });

describe("picks that can't go on the same slip", () => {
  it("rule 1: both sides of the same bet (Chiefs -3 and Seahawks +3)", () => {
    expect(findConflict([chiefsSpread], seahawksSpread, null)?.reason).toBe("both-sides");
  });

  it("rule 1: both teams to win (moneyline)", () => {
    expect(findConflict([chiefsMoneyline], seahawksMoneyline, null)?.reason).toBe("both-sides");
  });

  it("rule 2: the over and the under on the same total", () => {
    expect(findConflict([gameOver], gameUnder, null)?.reason).toBe("over-and-under");
  });

  it("rule 3: two different lines from the same bet (Chiefs -3 and Chiefs -3.5)", () => {
    const altSpread = pick({ marketKey: "alternate_spreads", line: -3.5, label: "Chiefs -3.5" });
    expect(findConflict([chiefsSpread], altSpread, null)?.reason).toBe("different-line");
  });

  it("rule 3: two different total lines (Over 47.5 and Over 50.5)", () => {
    const altOver = pick({ ...gameOver, marketKey: "alternate_totals", line: 50.5, label: "Over 50.5" });
    expect(findConflict([gameOver], altOver, null)?.reason).toBe("different-line");
  });

  it("rule 4: the same player for anytime TD and 2+ TDs", () => {
    const kelce2Tds = pick({ ...kelceAnytimeTd, marketKey: "player_tds_over", side: "over", line: 1.5, label: "Kelce 2+ TDs" });
    expect(findConflict([kelceAnytimeTd], kelce2Tds, null)?.reason).toBe("anytime-and-2plus-tds");
  });

  it("rule 5: the same player and stat with two lines (Mahomes over 249.5 and over 274.5)", () => {
    const over274 = pick({ ...mahomesPassOver249, marketKey: "player_pass_yds_alternate", line: 274.5, label: "Mahomes Over 274.5 Passing Yards" });
    expect(findConflict([mahomesPassOver249], over274, null)?.reason).toBe("different-line");
  });

  it("rule 6: the moneyline and the spread on the same team", () => {
    expect(findConflict([chiefsSpread], chiefsMoneyline, null)?.reason).toBe("moneyline-and-spread");
    // And the other way around.
    expect(findConflict([chiefsMoneyline], chiefsSpread, null)?.reason).toBe("moneyline-and-spread");
  });

  it("the popup message names the pick it clashes with", () => {
    const conflict = findConflict([chiefsSpread], seahawksSpread, null);
    expect(conflict?.conflictsWith).toBe(chiefsSpread);
    expect(conflict?.message).toContain("Chiefs -3");
  });
});

describe("picks that ARE allowed together", () => {
  it("a spread plus a player's receiving yards from the same game", () => {
    const kelceYards = pick({ marketKey: "player_reception_yds", marketCategory: "player-props", side: "over", line: 59.5, participant: kelce, label: "Kelce Over 59.5 Receiving Yards" });
    expect(findConflict([chiefsSpread], kelceYards, null)).toBeNull();
  });

  it("the same stat for two DIFFERENT players", () => {
    const smithPassing = pick({ ...mahomesPassOver249, participant: { kind: "player", id: "14881", name: "Geno Smith" }, label: "Smith Over 249.5 Passing Yards" });
    expect(findConflict([mahomesPassOver249], smithPassing, null)).toBeNull();
  });

  it("the same bet in a DIFFERENT game", () => {
    expect(findConflict([chiefsSpread], pick({ gameId: LAC_KC }), null)).toBeNull();
  });

  it("a full-game spread and a 1st-half spread", () => {
    const firstHalf = pick({ marketKey: "spreads_h1", period: "first-half", line: -1.5, label: "Chiefs -1.5 (1st Half)" });
    expect(findConflict([chiefsSpread], firstHalf, null)).toBeNull();
  });

  it("the moneyline on one team and the spread on the other", () => {
    expect(findConflict([chiefsMoneyline], seahawksSpread, null)).toBeNull();
  });

  it("spread, total, and a player prop together", () => {
    expect(findConflictInList([chiefsSpread, gameOver, mahomesPassOver249], null)).toBeNull();
  });
});

describe("Build your own SGP", () => {
  it("refuses a pick from a different game", () => {
    const conflict = findConflict([chiefsSpread], pick({ gameId: LAC_KC }), KC_SEA);
    expect(conflict?.reason).toBe("sgp-other-game");
    expect(conflict?.message).toBe("SGP picks must all come from the same game.");
  });

  it("refuses a different game even when the SGP has no picks yet", () => {
    expect(findConflict([], pick({ gameId: LAC_KC }), KC_SEA)?.reason).toBe("sgp-other-game");
  });

  it("accepts a pick from its own game", () => {
    expect(findConflict([chiefsSpread], mahomesPassOver249, KC_SEA)).toBeNull();
  });

  it("still applies the normal conflict rules inside an SGP", () => {
    expect(findConflict([chiefsSpread], seahawksSpread, KC_SEA)?.reason).toBe("both-sides");
  });

  it("2+ picks from one game is an SGP, with Estimated odds", () => {
    const pricing = getSlipPricing([chiefsSpread, mahomesPassOver249]);
    expect(pricing.type).toBe("sgp");
    expect(pricing.oddsAreEstimated).toBe(true);
  });

  it("an SGP with only 1 pick is saved as a straight bet", () => {
    const pricing = getSlipPricing([chiefsSpread]);
    expect(pricing.type).toBe("straight");
    expect(pricing.oddsAreEstimated).toBe(false);
  });

  it("2+ picks from different games is a parlay (not estimated)", () => {
    const pricing = getSlipPricing([chiefsSpread, pick({ gameId: LAC_KC, odds: 150 })]);
    expect(pricing.type).toBe("parlay");
    expect(pricing.combinedOdds).toBe(377);
    expect(pricing.oddsAreEstimated).toBe(false);
  });
});

describe("checking a whole list (what the server does)", () => {
  it("finds a conflict anywhere in the list", () => {
    expect(findConflictInList([chiefsSpread, gameOver, gameUnder], null)?.reason).toBe("over-and-under");
  });

  it("finds a pick from another game in an SGP list", () => {
    expect(findConflictInList([chiefsSpread, pick({ gameId: LAC_KC })], KC_SEA)?.reason).toBe("sgp-other-game");
  });
});

describe("baseMarket", () => {
  it("removes 'alternate' and the period ending", () => {
    expect(baseMarket("alternate_spreads")).toBe("spreads");
    expect(baseMarket("spreads_h1")).toBe("spreads");
    expect(baseMarket("alternate_totals_q3")).toBe("totals");
    expect(baseMarket("player_pass_yds_alternate")).toBe("player_pass_yds");
  });
});
