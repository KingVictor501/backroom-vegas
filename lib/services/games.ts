/*
  FILE: lib/services/games.ts
  WHAT IT'S FOR: Puts ESPN and The Odds API together. It takes ESPN's games,
  finds the same game in The Odds API (by team names and kickoff time), and
  attaches the odds from the user's sportsbook. This is what the Feed, the
  league page, and the matchup page will call.
  If The Odds API fails, the games still show (with dashes for odds) and
  oddsUnavailable is true, so the page can show a friendly note instead of
  crashing.
  WHO USES IT: Later: the games API routes (Section 6) and the Feed, league, and matchup pages (Sections 9-10).
  WHY THIS NAME: It's the main "games" service. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { getGameSummary, getWeekGames, type GameSummary } from "@/lib/services/espn/games";
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
