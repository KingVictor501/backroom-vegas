/*
  FILE: lib/services/espn/gameStats.test.ts
  WHAT IT'S FOR: Checks the matchup page's stats (live and final) against real saved ESPN data:
  the basketball live game in tests/fixtures, plus a football box score built in the same shape.
  WHO USES IT: `npm test` (Vitest).
  WHY THIS NAME: It tests gameStats.ts; ".test.ts" is how Vitest finds test files.
*/

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { espnGet } = vi.hoisted(() => ({ espnGet: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/cache", async (orig) => ({ ...(await orig<object>()), cached: <F,>(_k: string, _s: number, fn: F) => fn }));
vi.mock("./client", async (orig) => ({ ...(await orig<object>()), espnGet }));

import { gameSummarySchema } from "./schemas";
import { getGameStats } from "./gameStats";

/* answer: gives the fake ESPN call a saved answer, run through the real shape check like a live answer. */
function answer(json: unknown) {
  espnGet.mockImplementation(async () => gameSummarySchema.parse(json));
}

describe("getGameStats (basketball, live)", () => {
  beforeEach(() => espnGet.mockReset());

  it("lists only players who played, most points first, with the chosen columns", async () => {
    const live = JSON.parse(readFileSync("tests/fixtures/espn-nba-summary-live.json", "utf8"));
    answer(live);
    const stats = await getGameStats("nba", "1");
    expect(stats).not.toBeNull();
    const table = stats!.teams.flatMap((t) => t.tables)[0];
    expect(table.columns).toEqual(["MIN", "PTS", "REB", "AST", "FG", "3PT", "STL", "BLK", "TO"]);
    const points = table.rows.map((r) => Number(r.values[1]));
    expect(points).toEqual([...points].sort((a, b) => b - a));
    expect(table.rows.length).toBeLessThanOrEqual(12);
  });
});

describe("getGameStats (football, final)", () => {
  beforeEach(() => espnGet.mockReset());

  it("shows the chosen team numbers and the passing, rushing, and receiving tables, with the away team first", async () => {
    answer(JSON.parse(readFileSync("tests/fixtures/espn-nfl-summary-final.json", "utf8")));
    const stats = await getGameStats("nfl", "401873022");
    expect(stats?.status).toBe("final");
    const [away, home] = stats!.teams;
    expect([away.teamId, home.teamId]).toEqual(["12", "26"]); // KC at SEA
    expect(away.stats.map((s) => s.label)).toContain("Total Yards");
    expect(away.tables.map((t) => t.title)).toEqual(["Passing", "Rushing", "Receiving"]);
    expect(away.tables[0].columns).toContain("YDS");
    expect(away.tables[0].rows[0].name).toBe("Patrick Mahomes");
  });
});
