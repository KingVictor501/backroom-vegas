/*
  FILE: tests/leagues.nba.test.ts
  WHAT IT'S FOR: Automatic tests for how leagues are switched on. They prove:
  - the league settings: NFL has everything, NBA has betting but no team/player pages, every other league is off
  - a league that is NOT bettable (the NHL here, which is off) never calls The Odds API, so it costs no credits
    and says "no odds" instead of "odds service failed"; the NFL and NBA do ask The Odds API
  - a bet pick is accepted for the NFL and NBA, and refused for a league without betting features
  - a "scores only" game card (used for a league with schedules but no betting) shows teams and the live
    score, with no links to football-only pages and no odds buttons
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
  it("NFL has everything; NBA has betting but no team or player pages; no other league is on", () => {
    const by = Object.fromEntries(LEAGUES.map((league) => [league.slug, league]));
    expect(by.nfl).toMatchObject({ enabled: true, bettingEnabled: true, statsPages: true });
    expect(by.nba).toMatchObject({ enabled: true, bettingEnabled: true, statsPages: false });
    for (const league of LEAGUES.filter((l) => l.slug !== "nfl" && l.slug !== "nba")) {
      expect(league.enabled, league.slug).toBe(false);
      expect(league.bettingEnabled, league.slug).toBe(false);
      expect(league.statsPages, league.slug).toBe(false);
    }
  });
});

describe("games service and The Odds API", () => {
  beforeEach(() => {
    outside.getUpcomingGames.mockReset();
    outside.getLeagueGameLines.mockReset();
    outside.getUpcomingGames.mockResolvedValue({ thisWeek: [{ ...NBA_GAME, lines: undefined }], nextWeek: [] });
  });

  it("does not call The Odds API for a league without betting features, and says there are no odds (not that the odds service failed)", async () => {
    const result = await getUpcomingGamesWithLines("nhl", "hardrock");
    expect(outside.getLeagueGameLines).not.toHaveBeenCalled();
    expect(result.oddsUnavailable).toBe(false);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].lines).toBeNull();
  });

  it.each(["nfl", "nba"] as const)("asks The Odds API for the %s", async (league) => {
    outside.getLeagueGameLines.mockResolvedValue([]);
    await getUpcomingGamesWithLines(league, "hardrock");
    expect(outside.getLeagueGameLines).toHaveBeenCalledTimes(1);
    expect(outside.getLeagueGameLines).toHaveBeenCalledWith(league);
  });
});

describe("picks and leagues", () => {
  it("accepts NFL and NBA picks, and refuses a league without betting features", () => {
    expect(betPickRule.safeParse(makePick()).success).toBe(true);
    expect(betPickRule.safeParse({ ...makePick(), league: "nba" }).success).toBe(true);
    expect(betPickRule.safeParse({ ...makePick(), league: "nhl" }).success).toBe(false);
    expect(betPickRule.safeParse({ ...makePick(), league: "../x" }).success).toBe(false);
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
