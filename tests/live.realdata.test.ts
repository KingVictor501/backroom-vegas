/*
  FILE: tests/live.realdata.test.ts
  WHAT IT'S FOR: Runs REAL ESPN answers (saved as small files in tests/fixtures, captured on 2026-10-28
  while NBA games were in progress) through our live scores code. The other live tests use made-up
  answers; this one proves ESPN's real labels and numbers are read correctly:
  - STATUS_IN_PROGRESS → "Q4 6:14", STATUS_END_PERIOD → "End of Q3", a fresh quarter at 12:00
  - scores and points per quarter, a game that hasn't started shows no score
  - basketball box scores have no group names like "passing", and they used to make ESPN's whole game
    summary get rejected (the NBA matchup page crashed). Now player stats come through as "stats.points" etc.
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: Live scores tested with real data. It ends in .ts because it shows nothing on screen.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { gradePick } from "@/lib/betting/grading";
import { makePick } from "./support/factories";
import board from "./fixtures/espn-nba-scoreboard-live.json";
import summary from "./fixtures/espn-nba-summary-live.json";

const espn = vi.hoisted(() => ({ espnGet: vi.fn() }));
vi.mock("@/lib/services/espn/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/services/espn/client")>()), espnGet: espn.espnGet }));
vi.mock("@/lib/services/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/cache")>()),
  cached: <Args extends unknown[], Result>(_name: string, _seconds: number, fn: (...args: Args) => Promise<Result>) => fn,
}));

import { getLiveGames } from "@/lib/services/espn/live";

beforeEach(() => {
  // Like the real espnGet, the answer goes through the same zod schema before we use it.
  espn.espnGet.mockImplementation(async (url: string, schema: { parse: (data: unknown) => unknown }) =>
    schema.parse(url.endsWith("/scoreboard") ? board : summary),
  );
});

describe("live scores with real ESPN answers (NBA, 2026-10-28)", () => {
  it("reads games that are in progress, between quarters, just starting a quarter, and not started", async () => {
    const games = await getLiveGames("nba", ["401909881", "401909883", "401909885", "401909890"], false);
    const byId = Object.fromEntries(games.map((game) => [game.gameId, game]));

    expect(byId["401909881"]).toMatchObject({ status: "in-progress", label: "Q4 6:14", period: 4, awayScore: 111, homeScore: 107, awayPeriods: [34, 35, 28, 14], homePeriods: [25, 31, 29, 22] });
    expect(byId["401909883"]).toMatchObject({ status: "in-progress", label: "End of Q3", awayScore: 70, homeScore: 76 });
    expect(byId["401909885"]).toMatchObject({ status: "in-progress", label: "Q3 12:00", awayScore: 53, homeScore: 69 });
    expect(byId["401909890"]).toMatchObject({ status: "scheduled", label: "Scheduled", awayScore: null, homeScore: null, awayPeriods: [] });
  });

  it("lists the real team IDs so picks can be matched to the right side", async () => {
    const [game] = await getLiveGames("nba", ["401909881"], false);
    expect(game.awayTeamId).not.toBe(game.homeTeamId);
    expect(game.awayTeamId).toMatch(/^\d+$/);
  });

  it("reads the basketball box score even though it has no group names", async () => {
    const [game] = await getLiveGames("nba", ["401909881"], true);
    expect(game.players).not.toBeNull();
    const players = Object.values(game.players ?? {});
    expect(players.length).toBeGreaterThan(5);
    // Every player has numbers like points and rebounds under the "stats." prefix.
    const first = players[0];
    expect(first.name.length).toBeGreaterThan(2);
    expect(first.stats["stats.points"]).toBeTypeOf("number");
    expect(first.stats["stats.rebounds"]).toBeTypeOf("number");
  });
});

describe("grading NBA picks against the real live score (Heat 111 at Hawks 107, Q4 6:14)", () => {
  const NOW = Date.parse("2026-10-29T01:00:00Z");
  /* nbaPick: a pick on that real game, as a Heat (away) or Hawks (home) pick. */
  const nbaPick = (changes: Parameters<typeof makePick>[0]) => makePick({ league: "nba", gameId: "401909881", gameLabel: "MIA @ ATL", ...changes });

  it("spread: Heat -3 is winning (111 - 3 = 108 > 107); Heat -5 is losing (106 < 107); Hawks +5 is winning", async () => {
    const [game] = await getLiveGames("nba", ["401909881"], false);
    const heat = (line: number) => nbaPick({ side: "away", line, participant: { kind: "team", id: game.awayTeamId, name: "Miami Heat" } });
    const hawks = (line: number) => nbaPick({ side: "home", line, participant: { kind: "team", id: game.homeTeamId, name: "Atlanta Hawks" } });
    expect(gradePick(heat(-3), game, 4, NOW)).toEqual({ phase: "live", outcome: "win" });
    expect(gradePick(heat(-5), game, 4, NOW)).toEqual({ phase: "live", outcome: "lose" });
    expect(gradePick(hawks(5), game, 4, NOW)).toEqual({ phase: "live", outcome: "win" });
  });

  it("total: 218 points so far, Over 215.5 is winning and Under 215.5 is losing", async () => {
    const [game] = await getLiveGames("nba", ["401909881"], false);
    const total = (side: "over" | "under") => nbaPick({ marketKey: "totals", marketLabel: "Total", side, line: 215.5, participant: { kind: "game", id: null, name: "Game" } });
    expect(gradePick(total("over"), game, 4, NOW).outcome).toBe("win");
    expect(gradePick(total("under"), game, 4, NOW).outcome).toBe("lose");
  });

  it("moneyline: the Heat (ahead) are winning and the Hawks are losing", async () => {
    const [game] = await getLiveGames("nba", ["401909881"], false);
    const ml = (side: "home" | "away") => nbaPick({ marketKey: "h2h", marketLabel: "Winner", side, line: null });
    expect(gradePick(ml("away"), game, 4, NOW).outcome).toBe("win");
    expect(gradePick(ml("home"), game, 4, NOW).outcome).toBe("lose");
  });
});
