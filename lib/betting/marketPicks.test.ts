/*
  FILE: lib/betting/marketPicks.test.ts
  WHAT IT'S FOR: Automatic tests that prices on the matchup page become the
  right picks (labels, button words), and that the conflict rules still catch
  them, like a 2+ TDs pick after an anytime TD for the same player.
  Run them with: npm test
  WHO USES IT: Vitest. The app never loads this file.
  WHY THIS NAME: It tests marketPicks.ts, right next to it. It ends in .ts because it shows nothing on screen.
*/

import { describe, expect, it } from "vitest";
import { findConflict } from "./conflicts";
import { buttonText, marketPick, type PickGame } from "./marketPicks";
import type { MarketOutcome, MarketSection } from "@/types";

const game: PickGame = { gameId: "401873022", league: "nfl", gameLabel: "KC @ SEA", gameStartsAt: "2026-10-26T00:20Z" };
const mahomes = { kind: "player", id: "3139477", name: "Patrick Mahomes" } as const;
const kelce = { kind: "player", id: "15847", name: "Travis Kelce" } as const;
const chiefs = { kind: "team", id: "12", name: "Kansas City Chiefs" } as const;
const wholeGame = { kind: "game", id: null, name: "Game" } as const;

/* market: a test market. */
function market(key: string, label: string, category: MarketSection["market"]["category"], period: MarketSection["market"]["period"] = "full-game") {
  return { key, label, category, period };
}

/* added: a pick as it sits on a slip (with addedAt). */
const added = <P extends object>(pick: P) => ({ ...pick, addedAt: "2026-10-22T20:00:00Z" });

describe("matchup prices become picks", () => {
  it("player over/under", () => {
    const outcome: MarketOutcome = { side: "over", participant: mahomes, line: 274.5, odds: -115 };
    const pick = marketPick(game, market("player_pass_yds", "Passing Yards", "player-props"), outcome, "Patrick Mahomes", "hardrock");
    expect(pick.label).toBe("Patrick Mahomes Over 274.5 Passing Yards");
    expect(buttonText(outcome, true)).toBe("O 274.5");
  });

  it("anytime touchdown (one price, no button words)", () => {
    const outcome: MarketOutcome = { side: "yes", participant: kelce, line: null, odds: 120 };
    const pick = marketPick(game, market("player_anytime_td", "Anytime TD Scorer", "player-props"), outcome, "Travis Kelce", "hardrock");
    expect(pick.label).toBe("Travis Kelce Anytime TD Scorer");
    expect(buttonText(outcome, false)).toBeUndefined();
  });

  it("1st-half spread and winner", () => {
    const halfSpread: MarketOutcome = { side: "away", participant: chiefs, line: -1.5, odds: -110 };
    const halfWin: MarketOutcome = { side: "away", participant: chiefs, line: null, odds: -140 };
    expect(marketPick(game, market("spreads_h1", "Spread (1st Half)", "halves", "first-half"), halfSpread, "Chiefs", "hardrock").label).toBe("Chiefs -1.5 (1st Half)");
    expect(marketPick(game, market("h2h_h1", "Winner (1st Half)", "halves", "first-half"), halfWin, "Chiefs", "hardrock").label).toBe("Chiefs to win (1st Half)");
  });

  it("team total and game total", () => {
    const teamOver: MarketOutcome = { side: "over", participant: chiefs, line: 24.5, odds: -110 };
    const gameUnder: MarketOutcome = { side: "under", participant: wholeGame, line: 22.5, odds: -110 };
    expect(marketPick(game, market("team_totals", "Team Total Points", "team-props"), teamOver, "Chiefs", "hardrock").label).toBe("Chiefs Over 24.5 Team Total Points");
    expect(marketPick(game, market("totals_h1", "Total (1st Half)", "halves", "first-half"), gameUnder, "Game", "hardrock").label).toBe("Under 22.5 Total (1st Half)");
  });

  it("overtime yes/no", () => {
    const yes: MarketOutcome = { side: "yes", participant: wholeGame, line: null, odds: 900 };
    expect(marketPick(game, market("overtime", "Overtime?", "specials"), yes, "Game", "hardrock").label).toBe("Overtime? Yes");
    expect(buttonText(yes, true)).toBe("Yes");
  });

  it("the conflict rules still apply (anytime TD, then 2+ TDs for the same player)", () => {
    const anytime = added(marketPick(game, market("player_anytime_td", "Anytime TD Scorer", "player-props"), { side: "yes", participant: kelce, line: null, odds: 120 }, "Travis Kelce", "hardrock"));
    const twoPlus = marketPick(game, market("player_tds_over", "Touchdowns", "player-props"), { side: "over", participant: kelce, line: 1.5, odds: 650 }, "Travis Kelce", "hardrock");
    expect(findConflict([anytime], twoPlus, null)?.reason).toBe("anytime-and-2plus-tds");
  });

  it("a 1st-half spread does NOT clash with the full-game spread", () => {
    const full = added(marketPick(game, market("spreads", "Spread", "game-lines"), { side: "away", participant: chiefs, line: -3, odds: -110 }, "Chiefs", "hardrock"));
    const half = marketPick(game, market("spreads_h1", "Spread (1st Half)", "halves", "first-half"), { side: "away", participant: chiefs, line: -1.5, odds: -110 }, "Chiefs", "hardrock");
    expect(findConflict([full], half, null)).toBeNull();
  });
});
