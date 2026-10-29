/*
  FILE: tests/leagues.nba.test.ts
  WHAT IT'S FOR: Automatic tests for the NBA being "scores only" for now. They prove:
  - the league settings: NFL has betting, NBA is on but scores-only, every other league is still off
  - the games service never calls The Odds API for the NBA (so it costs no credits) and says "no odds"
    instead of "odds service failed"
  - a bet pick for an NBA game is refused (400-style validation error), because picks need odds, matchup and
    team pages the NBA doesn't have yet
  - an NBA game card shows both teams and the live score, has no links to football-only pages, and no odds buttons
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests the NBA scores-only setup. It ends in .ts because it shows nothing on screen.
*/

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEAGUES } from "@/config/leagues";
import { betPickRule } from "@/lib/betting/validation";
import type { GameWithLines } from "@/types";
import { makePick } from "./support/factories";

// Stand-ins for the outside services, so no test ever reaches ESPN or The Odds API.
const outside = vi.hoisted(() => ({ getUpcomingGames: vi.fn(), getLeagueGameLines: vi.fn() }));
vi.mock("@/lib/services/espn/games", () => ({ getUpcomingGames: outside.getUpcomingGames, getWeekGames: vi.fn(), getGameSummary: vi.fn() }));
vi.mock("@/lib/services/odds/lines", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/services/odds/lines")>()), getLeagueGameLines: outside.getLeagueGameLines }));

import GameCard from "@/components/feed/GameCard";
import { getUpcomingGamesWithLines } from "@/lib/services/games";

const team = (id: string, abbreviation: string, displayName: string) => ({ id, abbreviation, displayName, name: displayName, logoUrl: null, record: "3-1", color: null });
const NBA_GAME = {
  id: "401909881", league: "nba", startsAt: "2026-10-29T00:30:00Z", status: "in-progress", awayScore: 111, homeScore: 107, venue: null, oddsEventId: null, winProbability: null, lines: null,
  awayTeam: team("14", "MIA", "Miami Heat"), homeTeam: team("1", "ATL", "Atlanta Hawks"),
} as unknown as GameWithLines;

describe("league settings", () => {
  it("NFL has betting; NBA is on but scores-only; no other league is on", () => {
    const by = Object.fromEntries(LEAGUES.map((league) => [league.slug, league]));
    expect(by.nfl).toMatchObject({ enabled: true, bettingEnabled: true });
    expect(by.nba).toMatchObject({ enabled: true, bettingEnabled: false });
    for (const league of LEAGUES.filter((l) => l.slug !== "nfl" && l.slug !== "nba")) {
      expect(league.enabled, league.slug).toBe(false);
      expect(league.bettingEnabled, league.slug).toBe(false);
    }
  });
});

describe("games service for a scores-only league", () => {
  beforeEach(() => {
    outside.getUpcomingGames.mockReset();
    outside.getLeagueGameLines.mockReset();
    outside.getUpcomingGames.mockResolvedValue({ thisWeek: [{ ...NBA_GAME, lines: undefined }], nextWeek: [] });
  });

  it("does not call The Odds API for the NBA, and says there are no odds (not that the odds service failed)", async () => {
    const result = await getUpcomingGamesWithLines("nba", "hardrock");
    expect(outside.getLeagueGameLines).not.toHaveBeenCalled();
    expect(result.oddsUnavailable).toBe(false);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].lines).toBeNull();
  });

  it("still asks The Odds API for the NFL", async () => {
    outside.getLeagueGameLines.mockResolvedValue([]);
    await getUpcomingGamesWithLines("nfl", "hardrock");
    expect(outside.getLeagueGameLines).toHaveBeenCalledTimes(1);
  });
});

describe("picks for a scores-only league", () => {
  it("accepts an NFL pick and refuses an NBA pick", () => {
    expect(betPickRule.safeParse(makePick()).success).toBe(true);
    const nba = betPickRule.safeParse({ ...makePick(), league: "nba" });
    expect(nba.success).toBe(false);
  });
});

describe("GameCard for a scores-only league", () => {
  const html = renderToStaticMarkup(createElement(GameCard, { game: NBA_GAME, sportsbook: "hardrock", propsLink: null, scoresOnly: true }));

  it("shows both teams, their records, and the score", () => {
    expect(html).toContain("Miami Heat");
    expect(html).toContain("Atlanta Hawks");
    expect(html).toContain("111");
    expect(html).toContain("107");
  });
  it("has no links (the matchup and team pages only know football) and no odds or SGP buttons", () => {
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("SGP");
    expect(html).not.toContain("More bets");
  });
});
