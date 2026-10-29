/*
  FILE: lib/services/espn/basketball.test.ts
  WHAT IT'S FOR: Checks the NBA team/player page math and addresses: last-5 averages, which season number
  ESPN gets, and that the ?league= address setting only allows leagues with team and player pages.
  WHO USES IT: `npm test` (Vitest).
  WHY THIS NAME: It tests basketball.ts; ".test.ts" is how Vitest finds test files.
*/

import { describe, expect, it, vi } from "vitest";
import type { NbaPlayerGame } from "@/types";

// "server-only" would refuse to load outside the server; tests are not the browser, so stub it.
vi.mock("server-only", () => ({}));

import { LEAGUES } from "@/config/leagues";
import { parseStatsLeague, playerHref, teamHref } from "@/lib/leagues/links";
import { averageOf } from "./basketball";
import { seasonYearFor } from "./client";

/* game: a game-log row with only the numbers a test cares about. */
function game(points: number, fieldGoals: string): NbaPlayerGame {
  return {
    gameId: String(points), playedAt: "2026-10-28T23:00:00Z", opponentAbbreviation: "ATL", isHome: true, result: "W", score: "1-0",
    minutes: 30, points, rebounds: 5, assists: 5, steals: 1, blocks: 0, turnovers: 2, fieldGoals, threePointers: "1-4", freeThrows: "2-2",
  };
}

describe("averageOf", () => {
  it("averages points and works shooting % from total makes and attempts", () => {
    const avg = averageOf([game(20, "8-16"), game(30, "12-14")]);
    expect(avg.games).toBe(2);
    expect(avg.points).toBe(25);
    expect(avg.fieldGoalPct).toBe(66.7); // 20 made of 30, not the average of 50% and 85.7%
  });
  it("is all missing for no games", () => {
    expect(averageOf([]).points).toBeNull();
  });
});

describe("seasonYearFor", () => {
  const nba = LEAGUES.find((l) => l.slug === "nba")!;
  it("names the NBA season for the year it ends", () => {
    expect(seasonYearFor(nba, new Date("2026-10-28T12:00:00Z"))).toBe(2027);
    expect(seasonYearFor(nba, new Date("2027-03-01T12:00:00Z"))).toBe(2027);
  });
});

describe("league addresses", () => {
  it("keeps NFL addresses unchanged and adds ?league=nba for the NBA", () => {
    expect(teamHref("nfl", "12")).toBe("/team/12");
    expect(teamHref("nba", "14")).toBe("/team/14?league=nba");
    expect(playerHref("nba", "4066261")).toBe("/player/4066261?league=nba");
  });
  it("accepts no setting (NFL) or nba, and refuses unknown or turned-off leagues", () => {
    expect(parseStatsLeague(undefined)).toBe("nfl");
    expect(parseStatsLeague("nba")).toBe("nba");
    expect(parseStatsLeague("nhl")).toBeNull();
    expect(parseStatsLeague("{$gt:''}")).toBeNull();
  });
});
