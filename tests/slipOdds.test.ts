/*
  FILE: tests/slipOdds.test.ts
  WHAT IT'S FOR: Automatic tests for the odds lookup behind "Copy slip" (lib/services/slipOdds.ts).
  ESPN and The Odds API are replaced with made-up answers, so no real request is ever made.
  They prove the lookup is careful with your limited free Odds API requests:
  - Spread / Total / Winner picks are answered from the game lines the Feed already saved (no extra request)
  - other bets cost one request per game, asking only for the markets those picks use
  - no more than 4 games get their own request in one copy
  - picks whose game already started are never looked up
  and that trouble never crashes it: a failure just leaves picks "not checked".
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests slipOdds.ts. It sits in tests/ because it replaces two outside services. It ends in .ts
  because it shows nothing on screen.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentOddsForPicks, MAX_GAMES_LOOKED_UP } from "@/lib/services/slipOdds";
import type { BetPick, GameLines, GameWithLines, MarketOutcome } from "@/types";
import { makePick } from "./support/factories";

// Replace the real games service (ESPN + The Odds API) and the per-game odds calls.
const games = vi.hoisted(() => ({ getUpcomingGamesWithLines: vi.fn() }));
vi.mock("@/lib/services/games", () => games);
const lines = vi.hoisted(() => ({ getEventOdds: vi.fn(), marketsForBook: vi.fn() }));
vi.mock("@/lib/services/odds/lines", () => lines);

const NOW = new Date("2026-10-25T12:00:00Z");
const LATER = "2026-10-25T20:25:00Z";
const EARLIER = "2026-10-25T01:00:00Z";

const KC = { kind: "team", id: "12", name: "Kansas City Chiefs" } as const;
const SEA = { kind: "team", id: "26", name: "Seattle Seahawks" } as const;
const GAME = { kind: "game", id: null, name: "Game" } as const;

const out = (side: MarketOutcome["side"], participant: MarketOutcome["participant"], line: number | null, odds: number): MarketOutcome => ({
  side, participant, line, odds,
});

/* team: a team with just the fields the lookup reads. */
function team(id: string, displayName: string) {
  return { id, abbreviation: "XX", location: "X", name: displayName, displayName, logoUrl: null, record: null };
}

/* gameLines: the three game-card columns. */
const gameLines: GameLines = {
  sportsbook: "betmgm",
  spread: { away: out("away", KC, -3.5, -108), home: out("home", SEA, 3.5, -112) },
  total: { over: out("over", GAME, 47.5, -110), under: out("under", GAME, 47.5, -110) },
  moneyline: { away: out("away", KC, null, -170), home: out("home", SEA, null, 145) },
};

/* makeGame: a game the games service would list. */
function makeGame(id: string, changes: Partial<GameWithLines> = {}): GameWithLines {
  return {
    id, league: "nfl", startsAt: LATER, status: "scheduled",
    awayTeam: team("12", "Kansas City Chiefs"), homeTeam: team("26", "Seattle Seahawks"),
    awayScore: null, homeScore: null, venue: null, oddsEventId: `odds-${id}`, winProbability: null,
    lines: gameLines,
    ...changes,
  } as GameWithLines;
}

/* serve: what the games service returns. */
function serve(list: GameWithLines[], oddsUnavailable = false): void {
  games.getUpcomingGamesWithLines.mockResolvedValue({ games: list, thisWeekGameIds: list.map((g) => g.id), oddsUnavailable });
}

const spread = (gameId: string): BetPick => makePick({ gameId, gameStartsAt: LATER });
const prop = (gameId: string, key = "player_pass_yds"): BetPick =>
  makePick({
    gameId, gameStartsAt: LATER, marketKey: key, marketCategory: "player-props", marketLabel: "Passing Yards",
    participant: { kind: "player", id: null, name: "Patrick Mahomes" }, side: "over", line: 274.5, label: "Mahomes Over 274.5",
  });

beforeEach(() => {
  games.getUpcomingGamesWithLines.mockReset();
  lines.getEventOdds.mockReset();
  lines.marketsForBook.mockReset();
});

describe("game lines (free: no extra Odds API request)", () => {
  it("answers Spread, Total, and Winner picks from the saved game lines", async () => {
    serve([makeGame("1")]);
    const s = spread("1");
    const t = makePick({ gameId: "1", gameStartsAt: LATER, marketKey: "totals", participant: GAME, side: "over", line: 47.5, label: "Over 47.5" });
    const w = makePick({ gameId: "1", gameStartsAt: LATER, marketKey: "h2h", side: "away", line: null, label: "Chiefs to win" });
    const { odds } = await getCurrentOddsForPicks([s, t, w], "betmgm", NOW);

    expect(odds.get(s.id)).toEqual({ state: "outcomes", outcomes: [gameLines.spread.away, gameLines.spread.home] });
    expect(odds.get(t.id)).toEqual({ state: "outcomes", outcomes: [gameLines.total.over, gameLines.total.under] });
    expect(odds.get(w.id)).toEqual({ state: "outcomes", outcomes: [gameLines.moneyline.away, gameLines.moneyline.home] });
    expect(lines.getEventOdds).not.toHaveBeenCalled();
  });

  it("asks the games service once per league, for the user's sportsbook", async () => {
    serve([makeGame("1"), makeGame("2")]);
    await getCurrentOddsForPicks([spread("1"), spread("2")], "betmgm", NOW);
    expect(games.getUpcomingGamesWithLines).toHaveBeenCalledTimes(1);
    expect(games.getUpcomingGamesWithLines).toHaveBeenCalledWith("nfl", "betmgm");
  });

  it("a game with no lines from this book (a book with nothing posted) → 'none'", async () => {
    serve([makeGame("1", { lines: null })]);
    const s = spread("1");
    expect((await getCurrentOddsForPicks([s], "betmgm", NOW)).odds.get(s.id)).toEqual({ state: "none" });
  });

  it("reports ESPN's game statuses so the copy can skip finished or live games", async () => {
    serve([makeGame("1", { status: "in-progress" })]);
    expect((await getCurrentOddsForPicks([spread("1")], "betmgm", NOW)).gameStatuses.get("1")).toBe("in-progress");
  });

  it("a game that isn't on the upcoming list stays 'not-checked' (never guessed)", async () => {
    serve([]);
    const s = spread("1");
    expect((await getCurrentOddsForPicks([s], "betmgm", NOW)).odds.get(s.id)).toEqual({ state: "not-checked" });
  });
});

describe("other bets (one request per game)", () => {
  it("asks once for a game, with just the markets its picks use, and returns that market's prices", async () => {
    serve([makeGame("1")]);
    const a = prop("1", "player_pass_yds");
    const b = prop("1", "player_pass_tds");
    const c = prop("1", "player_pass_yds");
    lines.getEventOdds.mockResolvedValue({ id: "odds-1" });
    const prices = [out("over", { kind: "player", id: null, name: "Patrick Mahomes" }, 274.5, -115)];
    lines.marketsForBook.mockReturnValue([{ key: "player_pass_yds", outcomes: prices }]);

    const { odds } = await getCurrentOddsForPicks([a, b, c], "betmgm", NOW);
    expect(lines.getEventOdds).toHaveBeenCalledTimes(1);
    expect(lines.getEventOdds).toHaveBeenCalledWith("nfl", "odds-1", ["player_pass_yds", "player_pass_tds"]);
    expect(odds.get(a.id)).toEqual({ state: "outcomes", outcomes: prices });
    expect(odds.get(b.id)).toEqual({ state: "none" }); // the book returned no passing-TD market
  });

  it("a game The Odds API doesn't know about → 'none' without a request", async () => {
    serve([makeGame("1", { oddsEventId: null })]);
    const p = prop("1");
    expect((await getCurrentOddsForPicks([p], "betmgm", NOW)).odds.get(p.id)).toEqual({ state: "none" });
    expect(lines.getEventOdds).not.toHaveBeenCalled();
  });

  it("the Odds API returning nothing for the event → 'none'", async () => {
    serve([makeGame("1")]);
    lines.getEventOdds.mockResolvedValue(null);
    const p = prop("1");
    expect((await getCurrentOddsForPicks([p], "betmgm", NOW)).odds.get(p.id)).toEqual({ state: "none" });
  });

  it(`looks up at most ${MAX_GAMES_LOOKED_UP} games; the rest stay 'not-checked'`, async () => {
    const ids = ["1", "2", "3", "4", "5", "6"];
    serve(ids.map((id) => makeGame(id)));
    lines.getEventOdds.mockResolvedValue({ id: "x" });
    lines.marketsForBook.mockReturnValue([]);
    const picks = ids.map((id) => prop(id));
    const { odds } = await getCurrentOddsForPicks(picks, "betmgm", NOW);
    expect(lines.getEventOdds).toHaveBeenCalledTimes(MAX_GAMES_LOOKED_UP);
    expect(picks.filter((p) => odds.get(p.id)?.state === "not-checked")).toHaveLength(ids.length - MAX_GAMES_LOOKED_UP);
  });

  it("a failing request only affects that game's picks ('not-checked'), and never throws", async () => {
    serve([makeGame("1"), makeGame("2")]);
    lines.getEventOdds.mockRejectedValueOnce(new Error("The Odds API is out of requests")).mockResolvedValueOnce({ id: "x" });
    lines.marketsForBook.mockReturnValue([{ key: "player_pass_yds", outcomes: [out("over", GAME, 1, -110)] }]);
    const a = prop("1");
    const b = prop("2");
    const { odds } = await getCurrentOddsForPicks([a, b], "betmgm", NOW);
    expect(odds.get(a.id)).toEqual({ state: "not-checked" });
    expect(odds.get(b.id)?.state).toBe("outcomes");
  });
});

describe("never wasting requests, and never crashing", () => {
  it("doesn't look up a pick whose game already started", async () => {
    serve([makeGame("1", { status: "in-progress" }), makeGame("2")]);
    const started = prop("1");
    const early = makePick({ ...prop("2"), gameStartsAt: EARLIER });
    lines.getEventOdds.mockResolvedValue({ id: "x" });
    await getCurrentOddsForPicks([started, early], "betmgm", NOW);
    expect(lines.getEventOdds).not.toHaveBeenCalled();
  });

  it("when the games can't be loaded, every pick is 'not-checked' and nothing throws", async () => {
    games.getUpcomingGamesWithLines.mockRejectedValue(new Error("ESPN is down"));
    const s = spread("1");
    const p = prop("1");
    const { odds, gameStatuses } = await getCurrentOddsForPicks([s, p], "betmgm", NOW);
    expect(odds.get(s.id)).toEqual({ state: "not-checked" });
    expect(odds.get(p.id)).toEqual({ state: "not-checked" });
    expect(gameStatuses.size).toBe(0);
    expect(lines.getEventOdds).not.toHaveBeenCalled();
  });

  it("when The Odds API is unavailable, game lines and props are 'not-checked' (no requests)", async () => {
    serve([makeGame("1", { lines: null, oddsEventId: null })], true);
    const s = spread("1");
    const p = prop("1");
    const { odds } = await getCurrentOddsForPicks([s, p], "betmgm", NOW);
    expect(odds.get(s.id)).toEqual({ state: "not-checked" });
    expect(odds.get(p.id)).toEqual({ state: "not-checked" });
    expect(lines.getEventOdds).not.toHaveBeenCalled();
  });

  it("an empty slip makes no requests at all", async () => {
    const { odds } = await getCurrentOddsForPicks([], "betmgm", NOW);
    expect(odds.size).toBe(0);
    expect(games.getUpcomingGamesWithLines).not.toHaveBeenCalled();
  });
});
