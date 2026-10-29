/*
  FILE: tests/live.realdata.test.ts
  WHAT IT'S FOR: Runs REAL ESPN answers (saved as small files in tests/fixtures, captured on 2026-10-28
  while NBA games were in progress) through our live scores code. The other live tests use made-up
  answers; this one proves ESPN's real labels and numbers are read correctly:
  - STATUS_IN_PROGRESS → "Q4 6:14", STATUS_END_PERIOD → "End of Q3", a fresh quarter at 12:00
  - scores and points per quarter, a game that hasn't started shows no score
  KNOWN GAP (written down so it isn't forgotten): basketball box scores have no group names like
  "passing", so player stats come back empty (players: null) until NBA player props are built.
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: Live scores tested with real data. It ends in .ts because it shows nothing on screen.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("KNOWN GAP: a basketball box score has no group names, so no player stats yet", async () => {
    const [game] = await getLiveGames("nba", ["401909881"], true);
    expect(game.players).toBeNull();
  });
});
