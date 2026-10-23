/*
  FILE: lib/betting/gameLinePicks.test.ts
  WHAT IT'S FOR: Automatic tests that a game card's prices turn into the right
  picks: the right labels ("Chiefs -3", "Over 47.5", "Chiefs to win"), the
  same ID every time (so a second tap removes the pick), and that the conflict
  rules recognize them (both sides of a game-card spread clash).
  Run them with: npm test
  WHO USES IT: Vitest. The app never loads this file.
  WHY THIS NAME: It tests gameLinePicks.ts, right next to it. It ends in .ts because it shows nothing on screen.
*/

import { describe, expect, it } from "vitest";
import { findConflict } from "./conflicts";
import { gameLinePick } from "./gameLinePicks";
import type { GameWithLines, MarketOutcome, TeamSummary } from "@/types";

/* team: a test team. */
function team(id: string, abbreviation: string, name: string): TeamSummary {
  return { id, abbreviation, location: "", name, displayName: name, logoUrl: null, record: null };
}

/* A test game: Chiefs @ Seahawks. */
const game: GameWithLines = {
  id: "401873022",
  league: "nfl",
  startsAt: "2026-10-26T00:20Z",
  status: "scheduled",
  awayTeam: team("12", "KC", "Chiefs"),
  homeTeam: team("26", "SEA", "Seahawks"),
  awayScore: null,
  homeScore: null,
  venue: null,
  oddsEventId: "abc",
  winProbability: null,
  lines: null,
};

const chiefsMinus3: MarketOutcome = { side: "away", participant: { kind: "team", id: "12", name: "Kansas City Chiefs" }, line: -3, odds: -110 };
const seahawksPlus3: MarketOutcome = { side: "home", participant: { kind: "team", id: "26", name: "Seattle Seahawks" }, line: 3, odds: -110 };
const over: MarketOutcome = { side: "over", participant: { kind: "game", id: null, name: "Game" }, line: 47.5, odds: -110 };
const chiefsWin: MarketOutcome = { side: "away", participant: { kind: "team", id: "12", name: "Kansas City Chiefs" }, line: null, odds: -165 };

describe("game card prices become picks", () => {
  it("labels each kind of price", () => {
    expect(gameLinePick(game, "spread", chiefsMinus3, "hardrock").label).toBe("Chiefs -3");
    expect(gameLinePick(game, "spread", seahawksPlus3, "hardrock").label).toBe("Seahawks +3");
    expect(gameLinePick(game, "total", over, "hardrock").label).toBe("Over 47.5");
    expect(gameLinePick(game, "moneyline", chiefsWin, "hardrock").label).toBe("Chiefs to win");
  });

  it("names the game like KC @ SEA and remembers the sportsbook", () => {
    const pick = gameLinePick(game, "spread", chiefsMinus3, "betmgm");
    expect(pick.gameLabel).toBe("KC @ SEA");
    expect(pick.sportsbook).toBe("betmgm");
  });

  it("gives the same ID every time (so tapping again removes it)", () => {
    expect(gameLinePick(game, "spread", chiefsMinus3, "hardrock").id).toBe(gameLinePick(game, "spread", chiefsMinus3, "hardrock").id);
    expect(gameLinePick(game, "spread", chiefsMinus3, "hardrock").id).not.toBe(gameLinePick(game, "spread", seahawksPlus3, "hardrock").id);
  });

  it("works with the conflict rules (both sides of the spread clash)", () => {
    const chiefs = { ...gameLinePick(game, "spread", chiefsMinus3, "hardrock"), addedAt: "2026-10-22T20:00:00Z" };
    const conflict = findConflict([chiefs], gameLinePick(game, "spread", seahawksPlus3, "hardrock"), null);
    expect(conflict?.reason).toBe("both-sides");
  });

  it("works with the conflict rules (winner + spread on the same team clash)", () => {
    const chiefs = { ...gameLinePick(game, "spread", chiefsMinus3, "hardrock"), addedAt: "2026-10-22T20:00:00Z" };
    const conflict = findConflict([chiefs], gameLinePick(game, "moneyline", chiefsWin, "hardrock"), null);
    expect(conflict?.reason).toBe("moneyline-and-spread");
  });
});
