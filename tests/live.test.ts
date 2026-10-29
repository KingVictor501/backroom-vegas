/*
  FILE: tests/live.test.ts
  WHAT IT'S FOR: Automatic tests for live scores, with ESPN replaced by made-up answers (so no test
  ever calls ESPN or spends Odds API credits). They prove:
  - the live service turns ESPN's answers into scores and ready-made labels (Q3 7:32, Halftime, Final/OT)
  - scores stay hidden (null) before a game starts, even though ESPN says "0"
  - a game that isn't on this week's scoreboard is looked up on its own, and a fake game is left out
  - the box score is only attached when asked for, and one bad game never hides the others
  - at most 8 games are looked up one by one
  - GET /api/live refuses logged-out visitors (401) and bad input (400: letters, path tricks,
    injection-style values, too many or no games, a bad stats flag) before ESPN is ever asked
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests the live scores feature. It sits in tests/ because the route needs the
  test database for login. It ends in .ts because it shows nothing on screen.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/services/http";
import { createTestUser, logInAs, logOut, resetDatabase } from "./support/db";
import { GET as liveGet } from "@/app/api/live/route";

// Replace ESPN's web requests with answers the tests control. The rest of the ESPN client stays real.
const espn = vi.hoisted(() => ({ espnGet: vi.fn() }));
vi.mock("@/lib/services/espn/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/services/espn/client")>()), espnGet: espn.espnGet }));
// cached() normally saves answers between requests; in tests every call must ask again.
vi.mock("@/lib/services/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/cache")>()),
  cached: <Args extends unknown[], Result>(_name: string, _seconds: number, fn: (...args: Args) => Promise<Result>) => fn,
}));

import { getLiveGames } from "@/lib/services/espn/live";

/* ESPN-shaped pieces. Chiefs are away (id 12), Seahawks home (id 26). */
const team = (id: string, abbreviation: string, displayName: string) => ({ id, abbreviation, displayName });
function competitors(away: string, home: string, awayLines: number[], homeLines: number[]) {
  return [
    { id: "12", homeAway: "away", score: away, linescores: awayLines.map((value) => ({ value })), team: team("12", "KC", "Kansas City Chiefs") },
    { id: "26", homeAway: "home", score: home, linescores: homeLines.map((value) => ({ value })), team: team("26", "SEA", "Seattle Seahawks") },
  ];
}
const status = (name: string, state: string, period: number, displayClock: string, shortDetail: string, completed = false) => ({
  period,
  displayClock,
  type: { name, state, completed, shortDetail },
});
function event(id: string, st: ReturnType<typeof status>, away = "0", home = "0", awayLines: number[] = [], homeLines: number[] = []) {
  return { id, date: "2026-10-26T00:20Z", status: st, competitions: [{ status: st, competitors: competitors(away, home, awayLines, homeLines) }] };
}
const scoreboard = (...events: unknown[]) => ({ events });

const LIVE = event("1", status("STATUS_IN_PROGRESS", "in", 3, "7:32", "7:32 - 3rd"), "24", "20", [7, 10, 7], [3, 10, 7]);
const HALF = event("2", status("STATUS_HALFTIME", "in", 2, "0:00", "Halftime"), "17", "13", [7, 10], [3, 10]);
const OVERTIME = event("3", status("STATUS_FINAL", "post", 5, "0:00", "Final/OT", true), "27", "24", [7, 10, 7, 0, 3], [7, 7, 7, 3, 0]);
const FUTURE = event("4", status("STATUS_SCHEDULED", "pre", 0, "0:00", "Sun 8:20 PM"));

/* summary: an ESPN game summary answer (with a box score) for a game. */
function summary(id: string, st: ReturnType<typeof status>, away: string, home: string) {
  return {
    header: { competitions: [{ date: "2026-10-18T17:00Z", status: st, competitors: competitors(away, home, [], []).map((c, i) => ({ ...c, linescores: [{ displayValue: i === 0 ? "7" : "3" }, { displayValue: "10" }] })) }] },
    boxscore: {
      players: [
        {
          statistics: [
            {
              name: "passing",
              keys: ["completions/passingAttempts", "passingYards"],
              athletes: [{ athlete: { id: "3139477", displayName: "Patrick Mahomes" }, stats: ["18/25", "210"] }],
            },
          ],
        },
      ],
    },
  };
}

/* serve: ESPN answers by address. The scoreboard address ends in /scoreboard; summaries end in ?event=<id>. */
function serve(board: unknown, summaries: Record<string, unknown> = {}) {
  // Like the real espnGet, the answer goes through the same zod schema (which turns "24" into 24).
  espn.espnGet.mockImplementation(async (url: string, schema: { parse: (data: unknown) => unknown }) => {
    if (url.endsWith("/scoreboard")) {
      if (board instanceof Error) throw board;
      return schema.parse(board);
    }
    const id = /event=(\d+)/.exec(url)?.[1] ?? "";
    const answer = summaries[id];
    if (answer instanceof Error) throw answer;
    if (answer === undefined) throw new UpstreamError("ESPN", 404, "not found");
    return schema.parse(answer);
  });
}

beforeEach(() => {
  espn.espnGet.mockReset();
});

describe("live service: scoreboard games", () => {
  it("gives scores, quarter and clock, and per-quarter points for a live game", async () => {
    serve(scoreboard(LIVE));
    const [game] = await getLiveGames("nfl", ["1"], false);
    expect(game).toMatchObject({
      gameId: "1",
      status: "in-progress",
      label: "Q3 7:32",
      period: 3,
      clock: "7:32",
      halftime: false,
      awayScore: 24,
      homeScore: 20,
      awayTeamId: "12",
      homeTeamId: "26",
      awayPeriods: [7, 10, 7],
      homePeriods: [3, 10, 7],
      players: null,
    });
  });

  it("labels halftime and flags it", async () => {
    serve(scoreboard(HALF));
    const [game] = await getLiveGames("nfl", ["2"], false);
    expect(game).toMatchObject({ label: "Halftime", halftime: true, status: "in-progress" });
  });

  it("labels an overtime final", async () => {
    serve(scoreboard(OVERTIME));
    const [game] = await getLiveGames("nfl", ["3"], false);
    expect(game).toMatchObject({ label: "Final/OT", status: "final", awayScore: 27, homeScore: 24 });
  });

  it("hides the 0-0 before kickoff", async () => {
    serve(scoreboard(FUTURE));
    const [game] = await getLiveGames("nfl", ["4"], false);
    expect(game).toMatchObject({ label: "Scheduled", status: "scheduled", awayScore: null, homeScore: null, period: null, clock: null, awayPeriods: [] });
  });

  it("answers only for the asked-for games, once each", async () => {
    serve(scoreboard(LIVE, HALF, OVERTIME));
    const games = await getLiveGames("nfl", ["2", "1", "1"], false);
    expect(games.map((g) => g.gameId)).toEqual(["2", "1"]);
    expect(espn.espnGet).toHaveBeenCalledTimes(1);
  });

  it("a game missing from this week's scoreboard (an old slip) is looked up on its own", async () => {
    serve(scoreboard(LIVE), { "999": summary("999", status("STATUS_FINAL", "post", 4, "0:00", "Final", true), "31", "34") });
    const games = await getLiveGames("nfl", ["1", "999"], false);
    expect(games.map((g) => g.gameId)).toEqual(["1", "999"]);
    expect(games[1]).toMatchObject({ status: "final", label: "Final", awayScore: 31, homeScore: 34, awayPeriods: [7, 10], players: null });
  });

  it("leaves out a fake game ID, and a game whose lookup fails never hides the others", async () => {
    serve(scoreboard(LIVE), { "888": new UpstreamError("ESPN", 500, "broken") });
    const games = await getLiveGames("nfl", ["1", "777", "888"], false);
    expect(games.map((g) => g.gameId)).toEqual(["1"]);
  });

  it("asks ESPN about at most 8 games one by one", async () => {
    serve(scoreboard(), {});
    const ids = Array.from({ length: 20 }, (_, i) => String(100 + i));
    await getLiveGames("nfl", ids, false);
    // 1 scoreboard request + 8 single lookups.
    expect(espn.espnGet).toHaveBeenCalledTimes(9);
  });

  it("lets a scoreboard failure through, so the route can say ESPN isn't responding", async () => {
    serve(new UpstreamError("ESPN", 500, "down"));
    await expect(getLiveGames("nfl", ["1"], false)).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe("live service: box score", () => {
  const FINAL = status("STATUS_FINAL", "post", 4, "0:00", "Final", true);

  it("attaches player stats only when asked", async () => {
    serve(scoreboard(LIVE), { "1": summary("1", status("STATUS_IN_PROGRESS", "in", 3, "7:32", "7:32 - 3rd"), "24", "20") });
    const withStats = await getLiveGames("nfl", ["1"], true);
    expect(withStats[0].players).toEqual({
      "3139477": { name: "Patrick Mahomes", stats: { "passing.completions": 18, "passing.passingAttempts": 25, "passing.passingYards": 210 } },
    });
    const without = await getLiveGames("nfl", ["1"], false);
    expect(without[0].players).toBeNull();
  });

  it("falls back to the scoreboard game (no players) if the box score can't be loaded", async () => {
    serve(scoreboard(LIVE), { "1": new UpstreamError("ESPN", 500, "broken") });
    const [game] = await getLiveGames("nfl", ["1"], true);
    expect(game).toMatchObject({ gameId: "1", label: "Q3 7:32", players: null });
  });

  it("doesn't fetch a box score for a game that hasn't started", async () => {
    serve(scoreboard(FUTURE));
    await getLiveGames("nfl", ["4"], true);
    expect(espn.espnGet).toHaveBeenCalledTimes(1);
  });

  it("reads a finished game's summary", async () => {
    serve(scoreboard(), { "5": summary("5", FINAL, "31", "34") });
    const [game] = await getLiveGames("nfl", ["5"], true);
    expect(game.players?.["3139477"].stats["passing.passingYards"]).toBe(210);
  });
});

describe("GET /api/live", () => {
  const call = (query: string) => liveGet(new Request(`http://localhost:3000/api/live${query}`));

  beforeEach(async () => {
    await resetDatabase();
    const user = await createTestUser("fan@example.com");
    await logInAs(user);
    serve(scoreboard(LIVE));
  });

  it("answers 401 when logged out, without asking ESPN", async () => {
    logOut();
    const response = await call("?games=1");
    expect(response.status).toBe(401);
    expect(espn.espnGet).not.toHaveBeenCalled();
  });

  it("sends the live games to a logged-in user", async () => {
    const response = await call("?league=nfl&games=1");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { games: { gameId: string; label: string }[] };
    expect(body.games).toHaveLength(1);
    expect(body.games[0]).toMatchObject({ gameId: "1", label: "Q3 7:32" });
  });

  it.each([
    ["no games at all", ""],
    ["an empty list", "?games="],
    ["letters", "?games=abc"],
    ["a path trick", "?games=../../etc/passwd"],
    ["an encoded path trick", "?games=1%2F..%2F2"],
    ["an injection-style value", "?games[$gt]="],
    ["one bad ID among good ones", "?games=1,2,x"],
    ["an ID that is too long", "?games=1234567890123"],
    ["too many games", `?games=${Array.from({ length: 26 }, (_, i) => i + 1).join(",")}`],
    ["a huge list", `?games=${"1,".repeat(400)}`],
    ["a bad stats flag", "?games=1&stats=maybe"],
    ["a league that is turned off", "?games=1&league=nhl"],
    ["a made-up league", "?games=1&league=../x"],
  ])("refuses %s with a 400 and never asks ESPN", async (_name, query) => {
    const response = await call(query);
    expect(response.status).toBe(400);
    expect(espn.espnGet).not.toHaveBeenCalled();
  });

  it("accepts exactly 25 games", async () => {
    const response = await call(`?games=${Array.from({ length: 25 }, (_, i) => i + 1).join(",")}`);
    expect(response.status).toBe(200);
  });

  it("answers 502 with a friendly message (no details) when ESPN fails", async () => {
    serve(new UpstreamError("ESPN", 500, "secret internal detail"));
    const response = await call("?games=1");
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain("secret internal detail");
    expect(text).toContain("isn't responding right now");
  });
});
