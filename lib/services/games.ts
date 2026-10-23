/*
  FILE: lib/services/games.ts
  WHAT IT'S FOR: Puts ESPN and The Odds API together. It takes ESPN's games,
  finds the same game in The Odds API (by team names and kickoff time), and
  attaches the odds from the user's sportsbook. This is what the Feed, the
  league page, and the matchup page will call.
  If The Odds API fails, the games still show (with dashes for odds) and
  oddsUnavailable is true, so the page can show a friendly note instead of
  crashing.
  WHO USES IT: the games API routes (Section 6), the Feed and league page
  (Section 9), and later the matchup page (Section 10).
  WHY THIS NAME: It's the main "games" service. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { getGameSummary, getUpcomingGames, getWeekGames, type GameSummary } from "@/lib/services/espn/games";
import { getLeagueGameLines, toGameLines } from "@/lib/services/odds/lines";
import { findOddsEvent, teamIdLookup } from "@/lib/services/odds/match";
import type { OddsEvent } from "@/lib/services/odds/schemas";
import type { Game, GameWithLines, LeagueSlug, SportsbookId } from "@/types";

/*
  safeGameLines: the league's game lines, or null if The Odds API failed
  (missing on purpose: the games still show, with dashes for odds).
*/
async function safeGameLines(leagueSlug: LeagueSlug): Promise<OddsEvent[] | null> {
  try {
    return await getLeagueGameLines(leagueSlug);
  } catch (error) {
    console.error("Odds unavailable:", error);
    return null;
  }
}

/*
  withLines: one ESPN game + its matched Odds API game → GameWithLines for one book.
*/
function withLines(game: Game, events: OddsEvent[] | null, sportsbook: SportsbookId): GameWithLines {
  const event = events ? findOddsEvent(game, events) : null;
  return {
    ...game,
    oddsEventId: event?.id ?? null,
    lines: event ? toGameLines(event, sportsbook, teamIdLookup(game)) : null,
  };
}

/*
  GamesWithLinesResult: this week's games with odds.
  oddsUnavailable is true when The Odds API couldn't be reached.
*/
export type GamesWithLinesResult = { games: GameWithLines[]; oddsUnavailable: boolean };

/*
  getGamesWithLines: this week's games for a league, soonest first, each with
  the Spread / Total / Winner odds from the user's sportsbook.
  ESPN failing is a real error (no games to show). The Odds API failing is not.
*/
export async function getGamesWithLines(
  leagueSlug: LeagueSlug,
  sportsbook: SportsbookId,
): Promise<GamesWithLinesResult> {
  const [games, events] = await Promise.all([getWeekGames(leagueSlug), safeGameLines(leagueSlug)]);
  return {
    games: games.map((game) => withLines(game, events, sportsbook)),
    oddsUnavailable: events === null,
  };
}

/*
  UpcomingGamesResult: every game that hasn't finished yet (this week and next),
  soonest first, with odds. thisWeekGameIds says which ones are THIS week's, for
  the "This Week" filter. oddsUnavailable is true when The Odds API couldn't be reached.
*/
export type UpcomingGamesResult = {
  games: GameWithLines[];
  thisWeekGameIds: string[];
  oddsUnavailable: boolean;
};

/* STILL_TO_PLAY: game statuses the Feed shows. Finished and canceled games are left out. */
const STILL_TO_PLAY = new Set<Game["status"]>(["scheduled", "in-progress", "postponed"]);

/*
  getUpcomingGamesWithLines: for the Feed and the league page. Games in
  progress stay on the list (they're "current"), finished ones drop off.
  Costs no extra Odds API credits: one league-wide odds request (saved for 60
  minutes) covers this week and next week.
*/
export async function getUpcomingGamesWithLines(
  leagueSlug: LeagueSlug,
  sportsbook: SportsbookId,
): Promise<UpcomingGamesResult> {
  const [upcoming, events] = await Promise.all([getUpcomingGames(leagueSlug), safeGameLines(leagueSlug)]);
  const games = [...upcoming.thisWeek, ...upcoming.nextWeek]
    .filter((game) => STILL_TO_PLAY.has(game.status))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return {
    games: games.map((game) => withLines(game, events, sportsbook)),
    thisWeekGameIds: upcoming.thisWeek.map((game) => game.id),
    oddsUnavailable: events === null,
  };
}

/*
  GameWithLinesSummary: one game's details plus its odds, for the matchup page.
*/
export type GameWithLinesSummary = Omit<GameSummary, "game"> & {
  game: GameWithLines;
  oddsUnavailable: boolean;
};

/*
  getGameWithLines: one game (by ESPN ID) with its odds, or null if the game
  doesn't exist (a fake ID → "not found"). Reuses the saved league-wide lines,
  so opening a matchup costs no extra credits.
*/
export async function getGameWithLines(
  leagueSlug: LeagueSlug,
  gameId: string,
  sportsbook: SportsbookId,
): Promise<GameWithLinesSummary | null> {
  const [summary, events] = await Promise.all([
    getGameSummary(leagueSlug, gameId),
    safeGameLines(leagueSlug),
  ]);
  if (!summary) return null;
  return {
    ...summary,
    game: withLines(summary.game, events, sportsbook),
    oddsUnavailable: events === null,
  };
}
